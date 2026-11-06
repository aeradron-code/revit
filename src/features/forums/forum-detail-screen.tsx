import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { Globe, Plus, Trash2, Users } from "lucide-react-native";
import { useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";

import type { PostWithDetails } from "@/api/posts";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { ForumAvatar } from "@/features/forums/forum-avatar";
import { ForumCoverDisplay } from "@/features/forums/forum-cover-display";
import { AskPostCard } from "@/features/posts/ask-post-card";
import { PostFeedSkeleton } from "@/features/posts/post-feed-skeleton";
import { SharePostCard } from "@/features/posts/share-post-card";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import {
  useDeleteForum,
  useForum,
  useForumMembership,
  useForumPosts,
} from "@/queries/forums";

export function ForumDetailScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthUser();
  const forum = useForum(id, user?.id ?? "");
  const membership = useForumMembership(id, user?.id ?? "");
  const posts = useForumPosts(id, user?.id ?? "");
  const deleteForum = useDeleteForum();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  if (forum.isLoading) return <LoadingState />;

  const forumData = forum.data;
  if (forum.isError || !forumData) {
    return <MissingState description={forum.error?.message} />;
  }

  const isOwner = forumData.owner_id === user?.id;
  const showForumSidebarBesideFeed = windowWidth >= 768;
  const forumSidebarWidth = Math.min(320, Math.round(windowWidth * 0.3));
  const postItems = posts.data?.pages.flatMap((page) => page.items) ?? [];
  const aboutCommunity = (
    <Card className="rounded-lg p-4 shadow-none">
      <Text className="font-semibold">About this community</Text>
      <Text className="text-sm leading-5" variant="muted">
        {forumData.description?.trim() ||
          "A community for discussions, experiences, and recommendations."}
      </Text>

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
        <View className="flex-row items-center gap-1.5">
          <Icon as={Users} className="size-4 text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">
            {forumData.memberCount}{" "}
            {forumData.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon as={Globe} className="size-4 text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">Public forum</Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          disabled={membership.isPending || isOwner}
          size="sm"
          variant={forumData.isMember ? "outline" : "default"}
          onPress={() => membership.mutate(!forumData.isMember)}
        >
          <Text>
            {membership.isPending
              ? "Updating…"
              : isOwner
                ? "Owner"
                : forumData.isMember
                  ? "Leave"
                  : "Join"}
          </Text>
        </Button>

        {forumData.isMember ? (
          <Link href={routes.createForumPost(forumData.id)} asChild>
            <Button className="flex-1" size="sm" variant="outline">
              <Icon as={Plus} className="size-4" />
              <Text>Create post</Text>
            </Button>
          </Link>
        ) : null}
      </View>

      {membership.isError ? (
        <Text className="text-destructive" variant="small">
          {membership.error.message}
        </Text>
      ) : null}

      {forumData.rules ? (
        <View className="gap-1 border-t border-border pt-3">
          <Text className="text-sm font-semibold">Rules</Text>
          <Text variant="muted" className="text-sm leading-5">
            {forumData.rules}
          </Text>
        </View>
      ) : null}

      {isOwner ? (
        <Button
          className="w-full"
          size="sm"
          variant="destructive"
          onPress={() => setIsDeleteOpen(true)}
        >
          <Icon as={Trash2} className="size-4" />
          <Text>Delete forum</Text>
        </Button>
      ) : null}
    </Card>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              leading="back"
              onLeadingPress={() => router.replace(routes.forums)}
              title="Forums"
            />
          ),
        }}
      />
      <FlatList
        className="min-h-0 flex-1"
        contentContainerClassName="w-full py-1 md:mx-auto md:max-w-6xl md:px-6 md:py-2"
        data={postItems}
        keyExtractor={(post) => post.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View className="h-1" />}
        ListHeaderComponent={
          <View className="gap-1 md:gap-4">
            <View className="overflow-hidden rounded-lg border border-border bg-card shadow-none">
              <ForumCoverDisplay
                forumId={forumData.id}
                forumName={forumData.name}
                imageUrl={forumData.coverImageUrl}
                className="rounded-t-md"
              />
              <View className="p-3">
                <View className="flex-row items-center gap-3">
                  <ForumAvatar
                    name={forumData.name}
                    imageUrl={forumData.imageUrl}
                    size={48}
                  />
                  <View className="min-w-0 flex-1">
                    <Text className="text-lg font-semibold">
                      {forumData.name}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            {!showForumSidebarBesideFeed ? aboutCommunity : null}
            {!forumData.isMember ? (
              <Text variant="muted">
                Join to post, comment, or rate an Ask in this forum.
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className="relative w-full flex-row gap-3">
            <View className="min-w-0 flex-1">
              {posts.isLoading ? <PostsLoadingState /> : null}
              {posts.isError ? (
                <FeedbackState
                  actionLabel="Retry"
                  onAction={() => void posts.refetch()}
                  title="Couldn’t load forum posts."
                  variant="error"
                />
              ) : null}
              {!posts.isLoading && !posts.isError ? (
                <FeedbackState title="No forum posts yet" />
              ) : null}
            </View>
            {showForumSidebarBesideFeed ? (
              <View style={{ width: forumSidebarWidth, flexShrink: 0 }} />
            ) : null}
            {showForumSidebarBesideFeed ? (
              <View
                className="absolute right-0 top-0 w-full gap-3"
                style={{ width: forumSidebarWidth }}
              >
                {aboutCommunity}
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          posts.isFetchNextPageError ? (
            <View className="relative flex-row gap-3">
              <View className="min-w-0 flex-1">
                <FeedbackState
                  actionLabel="Try again"
                  onAction={() => void posts.fetchNextPage()}
                  title="Couldn’t load more forum posts."
                  variant="error"
                />
              </View>
              {showForumSidebarBesideFeed ? (
                <View style={{ width: forumSidebarWidth, flexShrink: 0 }} />
              ) : null}
            </View>
          ) : posts.hasNextPage ? (
            <View className="flex-row gap-3">
              <View className="min-w-0 flex-1">
                <Button
                  disabled={posts.isFetchingNextPage}
                  variant="outline"
                  onPress={() => void posts.fetchNextPage()}
                >
                  <Text>
                    {posts.isFetchingNextPage
                      ? "Loading more posts…"
                      : "Load more posts"}
                  </Text>
                </Button>
              </View>
              {showForumSidebarBesideFeed ? (
                <View style={{ width: forumSidebarWidth, flexShrink: 0 }} />
              ) : null}
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <View className="relative w-full flex-row gap-3">
            <View className="min-w-0 flex-1">
              <ForumPostCard
                post={item}
                canInteract={forumData.isMember || isOwner}
              />
            </View>
            {showForumSidebarBesideFeed ? (
              <View style={{ width: forumSidebarWidth, flexShrink: 0 }} />
            ) : null}
            {showForumSidebarBesideFeed && index === 0 ? (
              <View
                className="absolute right-0 top-0 w-full gap-3"
                style={{ width: forumSidebarWidth }}
              >
                {aboutCommunity}
              </View>
            ) : null}
          </View>
        )}
      />
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this forum?</DialogTitle>
            <DialogDescription>
              This permanently deletes its posts, comments, and memberships.
            </DialogDescription>
          </DialogHeader>
          {deleteForum.isError ? (
            <Text variant="small" className="text-destructive">
              {deleteForum.error.message}
            </Text>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onPress={() => setIsDeleteOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button
              disabled={deleteForum.isPending}
              variant="destructive"
              onPress={() =>
                void deleteForum
                  .mutateAsync(forumData.id)
                  .then(() => router.replace(routes.forums))
                  .catch(() => {})
              }
            >
              <Text>
                {deleteForum.isPending ? "Deleting…" : "Delete forum"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SafeAreaView>
  );
}

function ForumPostCard({
  canInteract,
  post,
}: {
  canInteract: boolean;
  post: PostWithDetails;
}) {
  if (post.post_type === "ASK") {
    return <AskPostCard canInteract={canInteract} post={post} />;
  }

  return <ForumSharePostCard canInteract={canInteract} post={post} />;
}

function ForumSharePostCard({
  canInteract,
  post,
}: {
  canInteract: boolean;
  post: PostWithDetails;
}) {
  if (!post.forumShare) {
    return (
      <FeedbackState
        description="This find’s rating is unavailable."
        title="Share post unavailable"
        variant="error"
      />
    );
  }

  return (
    <SharePostCard
      canInteract={canInteract}
      post={{ ...post, ratingScore: post.forumShare.ratingScore }}
      entity={post.forumShare.entity}
    />
  );
}

function LoadingState() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              showAccountActions
              title="Forums"
              onBack={() => router.replace(routes.forums)}
            />
          ),
        }}
      />
      <View className="px-6 py-6 md:mx-auto md:w-full md:max-w-2xl">
        <ContentSkeleton rows={3} />
      </View>
    </SafeAreaView>
  );
}

function PostsLoadingState() {
  return <PostFeedSkeleton rows={2} />;
}

function MissingState({ description }: { description?: string }) {
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center gap-2 bg-background px-6"
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader
              showAccountActions
              title="Forums"
              onBack={() => router.replace(routes.forums)}
            />
          ),
        }}
      />
      <Text variant="h2">Forum unavailable</Text>
      <Text variant="muted" className="text-center">
        {description ?? "This forum may have been deleted."}
      </Text>
    </SafeAreaView>
  );
}
