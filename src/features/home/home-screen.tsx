import { useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import {
  ArrowRight,
  MessageCircleQuestion,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  View,
} from "react-native";

import type { HomeFeedPost } from "@/api/feed";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { AskPostCard } from "@/features/posts/ask-post-card";
import { PostFeedSkeleton } from "@/features/posts/post-feed-skeleton";
import { SharePostCard } from "@/features/posts/share-post-card";
import { queryKeys } from "@/lib/query/query-keys";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useHomeFeed } from "@/queries/feed";

type FeedMode = "following" | "for-you";

export function HomeScreen() {
  const user = useAuthUser();
  const [feedMode, setFeedMode] = useState<FeedMode>("following");
  const feed = useHomeFeed(user?.id ?? "", feedMode);
  const queryClient = useQueryClient();
  const posts = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const refreshFeed = () =>
    queryClient.resetQueries({
      queryKey: queryKeys.feed.home(user?.id ?? "", feedMode),
    });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <FlatList
        contentContainerClassName="gap-1 md:gap-2 md:px-6 md:py-6 py-1"
        data={posts}
        keyExtractor={(post) => post.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <FeedHeader
            feedMode={feedMode}
            isRefreshing={feed.isFetching && !feed.isFetchingNextPage}
            onChangeFeedMode={setFeedMode}
            onRefresh={() => void refreshFeed()}
          />
        }
        ListEmptyComponent={<FeedEmpty feed={feed} feedMode={feedMode} />}
        ListFooterComponent={<FeedFooter feed={feed} />}
        refreshControl={
          <RefreshControl
            refreshing={feed.isFetching && !feed.isFetchingNextPage}
            onRefresh={() => void refreshFeed()}
          />
        }
        renderItem={({ item }) => <HomeFeedItem post={item} />}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage)
            void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
}

function FeedHeader({
  feedMode,
  isRefreshing,
  onChangeFeedMode,
  onRefresh,
}: {
  feedMode: FeedMode;
  isRefreshing: boolean;
  onChangeFeedMode: (mode: FeedMode) => void;
  onRefresh: () => void;
}) {
  return (
    <View className="mx-auto w-full max-w-xl">
      <View className="gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <View className="size-10 items-center justify-center rounded-full bg-primary/10">
            <Icon as={Sparkles} className="size-5 text-primary" />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-semibold">Share what’s on your mind</Text>
            <Text className="text-sm" variant="muted">
              Ask your circle or recommend a place.
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Link href={routes.createAsk} asChild>
            <Button className="flex-1 sm:flex-none" size="sm">
              <Icon as={MessageCircleQuestion} />
              <Text>Ask</Text>
            </Button>
          </Link>
          <Link href={routes.createShare} asChild>
            <Button className="flex-1 sm:flex-none" size="sm" variant="outline">
              <Icon as={Star} />
              <Text>Share</Text>
            </Button>
          </Link>
        </View>
      </View>

      <View className="flex-row items-center border-b border-border">
        <View accessibilityRole="tablist" className="flex-1 flex-row">
          <FeedModeButton
            active={feedMode === "following"}
            label="Following"
            onPress={() => onChangeFeedMode("following")}
          />
          <FeedModeButton
            active={feedMode === "for-you"}
            label="For you"
            onPress={() => onChangeFeedMode("for-you")}
          />
        </View>
        {Platform.OS === "web" ? (
          <Button
            accessibilityLabel="Refresh feed"
            className="mr-1"
            disabled={isRefreshing}
            size="icon"
            variant="ghost"
            onPress={onRefresh}
          >
            <Icon
              as={RefreshCw}
              className={isRefreshing ? "animate-spin" : undefined}
            />
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function FeedModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className={`h-11 min-w-28 items-center justify-center border-b-2 px-3 ${active ? "border-primary" : "border-transparent"}`}
      onPress={onPress}
    >
      <Text
        className={`text-sm ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HomeFeedItem({ post }: { post: HomeFeedPost }) {
  return (
    <View className="mx-auto w-full max-w-3xl">
      {post.post_type === "ASK" ? (
        <AskPostCard post={post} />
      ) : (
        <SharePostCard post={post} entity={post.entity} />
      )}
    </View>
  );
}

function FeedEmpty({
  feed,
  feedMode,
}: {
  feed: ReturnType<typeof useHomeFeed>;
  feedMode: FeedMode;
}) {
  if (feed.isLoading) {
    return <PostFeedSkeleton />;
  }
  if (feed.isError) {
    return (
      <FeedbackState
        actionLabel="Retry"
        className="mx-auto w-full max-w-3xl"
        onAction={() => void feed.refetch()}
        title="Couldn’t load your feed."
        variant="error"
      />
    );
  }
  if (feedMode === "for-you") {
    return (
      <FeedbackState
        className="mx-auto w-full max-w-3xl"
        description="There are no recommendations to show right now."
        title="Nothing here yet"
      />
    );
  }
  return (
    <View className="mx-auto w-full max-w-3xl items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-none sm:flex-row sm:items-center">
      <View className="size-10 items-center justify-center rounded-md bg-accent">
        <Icon as={Sparkles} className="size-5 text-accent-foreground" />
      </View>
      <View className="min-w-0 flex-1 gap-1.5">
        <Text className="text-base font-bold">Your feed will appear here.</Text>
        <Text variant="muted" className="max-w-xl text-sm leading-5">
          Follow a few people and their Ask posts and ratings will land here.
        </Text>
      </View>
      <Button variant="secondary" onPress={() => router.push(routes.discover)}>
        <Text>Discover people</Text>
        <Icon as={ArrowRight} />
      </Button>
    </View>
  );
}

function FeedFooter({ feed }: { feed: ReturnType<typeof useHomeFeed> }) {
  if (!feed.hasNextPage && !feed.isFetchingNextPage) return null;
  return (
    <View className="mx-auto w-full max-w-3xl items-center py-2">
      <Button
        disabled={!feed.hasNextPage || feed.isFetchingNextPage}
        variant="outline"
        onPress={() => void feed.fetchNextPage()}
      >
        <Text>{feed.isFetchingNextPage ? "Loading…" : "Load more"}</Text>
      </Button>
    </View>
  );
}
