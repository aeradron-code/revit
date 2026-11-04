import { Redirect, router, useLocalSearchParams } from "expo-router";
import { MoreVertical, Pencil, Trash2 } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  View,
} from "react-native";

import type { PostWithDetails } from "@/api/posts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { CommentSection } from "@/features/comments/comment-section";
import { ProfileMessageScreen } from "@/features/profile/profile-state-screen";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useTopLevelComments } from "@/queries/comments";
import { useEntity } from "@/queries/entities";
import { useDeletePost, usePost, useUpdateAskPost } from "@/queries/posts";
import { useShareRatingScore } from "@/queries/shares";

import { AskPostCard } from "./ask-post-card";
import { SharePostCard } from "./share-post-card";
import { PostDetailFrame } from "./post-detail-frame";

export function PostDetailScreen() {
  const user = useAuthUser();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const post = usePost(postId, user?.id ?? "");

  if (post.isLoading) {
    return <PostDetailLoading />;
  }

  if (post.isError) {
    return (
      <PostDetailMessage
        title="Post unavailable"
        description="We couldn’t load this post. Check your connection and try again."
        action={() => void post.refetch()}
      />
    );
  }

  if (!post.data) {
    return (
      <PostDetailMessage
        title="Post not found"
        description="This post may have been removed or is no longer available."
      />
    );
  }

  if (post.data.forum_id) {
    return (
      <Redirect href={routes.forumPost(post.data.forum_id, post.data.id)} />
    );
  }

  if (post.data.post_type === "SHARE")
    return (
      <SharePostDetail
        isPostRefetching={post.isRefetching}
        post={post.data}
        refetchPost={post.refetch}
      />
    );

  return (
    <AskPostDetail
      isRefetching={post.isRefetching}
      post={post.data}
      refetch={post.refetch}
    />
  );
}

function SharePostDetail({
  isPostRefetching,
  post,
  refetchPost,
}: {
  isPostRefetching: boolean;
  post: PostWithDetails;
  refetchPost: ReturnType<typeof usePost>["refetch"];
}) {
  const user = useAuthUser();
  const entity = useEntity(post.entity_id ?? "");
  const viewerId = user?.id ?? "";
  const ratingScore = useShareRatingScore(post.id, viewerId);
  const comments = useTopLevelComments(post.id, { viewerId });
  const score = ratingScore.data;

  if (entity.isLoading || ratingScore.isLoading) return <PostDetailLoading />;

  if (entity.isError || ratingScore.isError) {
    return (
      <PostDetailMessage
        title="Share post unavailable"
        description="We couldn’t load this rating. Check your connection and try again."
        action={() =>
          void Promise.all([entity.refetch(), ratingScore.refetch()])
        }
      />
    );
  }

  if (!entity.data || score === null || score === undefined) {
    return (
      <PostDetailMessage
        title="Share post unavailable"
        description="This rating may have been removed or is no longer available."
      />
    );
  }

  return (
    <PostDetailFrame onBack={goBackFromPost} title="Post">
      <View className="flex-1 gap-4 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:gap-6 md:px-6 md:py-6">
        <SharePostCard
          isDetail
          post={{ ...post, ratingScore: score }}
          entity={entity.data}
        />
        <CommentSection
          comments={comments}
          postId={post.id}
          refreshControl={
            <RefreshControl
              refreshing={
                isPostRefetching ||
                entity.isRefetching ||
                ratingScore.isRefetching ||
                comments.isRefetching
              }
              onRefresh={() =>
                void Promise.all([
                  refetchPost(),
                  entity.refetch(),
                  ratingScore.refetch(),
                  comments.refetch(),
                ])
              }
            />
          }
        />
      </View>
    </PostDetailFrame>
  );
}

function AskPostDetail({
  isRefetching,
  post,
  refetch,
}: {
  isRefetching: boolean;
  post: PostWithDetails;
  refetch: ReturnType<typeof usePost>["refetch"];
}) {
  const user = useAuthUser();
  const isAuthor = user?.id === post.author_id;
  const comments = useTopLevelComments(post.id, { viewerId: user?.id ?? "" });

  return (
    <PostDetailFrame onBack={goBackFromPost} title="Post">
      <View className="flex-1 gap-4 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:gap-6 md:px-6 md:py-6">
        <AskPostCard
          isDetail
          post={post}
          ownerActions={isAuthor ? <AuthorActions post={post} /> : undefined}
        />
        <CommentSection
          comments={comments}
          postId={post.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || comments.isRefetching}
              onRefresh={() =>
                void Promise.all([refetch(), comments.refetch()])
              }
            />
          }
        />
      </View>
    </PostDetailFrame>
  );
}

function AuthorActions({ post }: { post: PostWithDetails }) {
  const triggerRef = useRef<React.ElementRef<typeof View>>(null);
  const { width, height } = useWindowDimensions();
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const updatePost = useUpdateAskPost(post.id, post.author_id);
  const deletePost = useDeletePost();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [body, setBody] = useState(post.body ?? "");
  const canSave =
    body.trim().length >= 1 &&
    body.trim().length <= 2000 &&
    !updatePost.isPending;

  const openEditor = () => {
    setBody(post.body ?? "");
    updatePost.reset();
    setIsEditOpen(true);
  };

  const save = async () => {
    if (!canSave) return;

    try {
      await updatePost.mutateAsync({ body });
      setIsEditOpen(false);
    } catch {
      // The mutation error stays visible in the editor for a retry.
    }
  };

  const remove = async () => {
    try {
      await deletePost.mutateAsync(post.id);
      setIsDeleteOpen(false);
      router.replace(
        post.forum_id ? routes.forum(post.forum_id) : routes.profile,
      );
    } catch {
      // The mutation error stays visible in the confirmation for a retry.
    }
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Button
          accessibilityLabel="Post options"
          accessibilityState={{ expanded: menuPosition !== null }}
          className="size-8 rounded-full p-0"
          size="icon"
          variant="ghost"
          onPress={() =>
            triggerRef.current?.measureInWindow((x, y, w, h) =>
              setMenuPosition({
                top: Math.min(y + h + 4, height - 110),
                right: Math.max(8, width - x - w),
              }),
            )
          }
        >
          <Icon as={MoreVertical} className="size-4 text-foreground" />
        </Button>
      </View>
      <Modal
        transparent
        visible={menuPosition !== null}
        onRequestClose={() => setMenuPosition(null)}
      >
        <View className="flex-1">
          <Pressable
            className="absolute inset-0"
            accessibilityRole="button"
            accessibilityLabel="Close post options"
            onPress={() => setMenuPosition(null)}
          />
          {menuPosition ? (
            <View
              className="absolute w-44 rounded-lg border border-border bg-popover p-1 shadow-lg"
              style={menuPosition}
            >
              <Button
                className="w-full justify-start"
                size="sm"
                variant="ghost"
                onPress={() => {
                  setMenuPosition(null);
                  openEditor();
                }}
              >
                <Icon as={Pencil} className="size-4 text-foreground" />
                <Text>Edit post</Text>
              </Button>
              <Button
                className="w-full justify-start"
                size="sm"
                variant="ghost"
                onPress={() => {
                  setMenuPosition(null);
                  setIsDeleteOpen(true);
                }}
              >
                <Icon as={Trash2} className="size-4 text-destructive" />
                <Text className="text-destructive">Delete post</Text>
              </Button>
            </View>
          ) : null}
        </View>
      </Modal>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ask</DialogTitle>
            <DialogDescription>
              Update the details. Existing images keep their order.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-4">
            <View className="gap-2">
              <Text variant="small">Details (optional)</Text>
              <Textarea
                editable={!updatePost.isPending}
                maxLength={2000}
                value={body}
                onChangeText={setBody}
              />
              <Text variant="muted" className="text-right">
                {body.length}/2000
              </Text>
            </View>

            {updatePost.isError ? (
              <Text variant="small" className="text-destructive">
                {updatePost.error.message}
              </Text>
            ) : null}
          </View>

          <DialogFooter>
            <Button
              disabled={updatePost.isPending}
              variant="secondary"
              onPress={() => setIsEditOpen(false)}
            >
              <Text>Cancel</Text>
            </Button>
            <Button disabled={!canSave} onPress={() => void save()}>
              <Text>{updatePost.isPending ? "Saving…" : "Save changes"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this Ask?</DialogTitle>
            <DialogDescription>
              The post and its images will be removed permanently.
            </DialogDescription>
          </DialogHeader>

          {deletePost.isError ? (
            <Text variant="small" className="text-destructive">
              {deletePost.error.message}
            </Text>
          ) : null}

          <DialogFooter>
            <Button
              disabled={deletePost.isPending}
              variant="secondary"
              onPress={() => setIsDeleteOpen(false)}
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              disabled={deletePost.isPending}
              variant="destructive"
              onPress={() => void remove()}
            >
              <Text>{deletePost.isPending ? "Deleting…" : "Delete Ask"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PostDetailLoading() {
  return (
    <PostDetailFrame onBack={goBackFromPost} title="Post">
      <View className="w-full gap-5 px-4 md:mx-auto md:max-w-3xl md:px-6 md:py-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-8 w-4/5" />
        <Skeleton className="h-52 w-full" />
      </View>
    </PostDetailFrame>
  );
}

function PostDetailMessage({
  action,
  description,
  title,
}: {
  action?: () => void;
  description: string;
  title: string;
}) {
  return (
    <PostDetailFrame onBack={goBackFromPost} title="Post">
      <ProfileMessageScreen
        action={action}
        description={description}
        title={title}
      />
    </PostDetailFrame>
  );
}

function goBackFromPost() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(routes.home);
}
