import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import type { PostWithDetails } from "@/api/posts";
import type { SharePostWithDetails } from "@/api/shares";
import { FeedbackState } from "@/components/ui/feedback-state";
import {
  CommentListSkeleton,
  CommentSection,
} from "@/features/comments/comment-section";
import { AskPostCard } from "@/features/posts/ask-post-card";
import { SharePostCard } from "@/features/posts/share-post-card";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useTopLevelComments } from "@/queries/comments";
import { useEntity } from "@/queries/entities";
import { usePost } from "@/queries/posts";
import { useShareRatingScore } from "@/queries/shares";
import { useForum } from "@/queries/forums";
import { PostDetailFrame } from "@/features/posts/post-detail-frame";
import { PostCardSkeleton } from "@/features/posts/post-feed-skeleton";

export function ForumPostDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    postId?: string | string[];
  }>();
  const forumId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const postId = Array.isArray(params.postId)
    ? params.postId[0]
    : (params.postId ?? "");
  const user = useAuthUser();
  const viewerId = user?.id ?? "";
  const forum = useForum(forumId, viewerId);
  const canInteract = Boolean(
    forum.data && (forum.data.isMember || forum.data.owner_id === user?.id),
  );
  const post = usePost(postId, viewerId);
  const comments = useTopLevelComments(postId, { viewerId });

  if (!forumId || !postId || !viewerId || post.isLoading) {
    return (
      <ForumPostFrame forumId={forumId}>
        <View className="min-h-0 flex-1 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:px-6 md:py-6">
          <View className="mx-auto w-full max-w-[36rem] gap-3">
            <PostCardSkeleton withMedia />
            <CommentListSkeleton />
          </View>
        </View>
      </ForumPostFrame>
    );
  }

  if (post.isError) {
    return (
      <ForumPostFrame forumId={forumId}>
        <FeedbackState
          actionLabel="Retry"
          onAction={() => void post.refetch()}
          title="Couldn’t load this forum post."
          variant="error"
        />
      </ForumPostFrame>
    );
  }

  if (!post.data) {
    return (
      <ForumPostFrame forumId={forumId}>
        <FeedbackState title="This forum post is unavailable." />
      </ForumPostFrame>
    );
  }

  if (post.data.forum_id !== forumId) {
    return post.data.forum_id ? (
      <Redirect href={routes.forumPost(post.data.forum_id, post.data.id)} />
    ) : (
      <Redirect href={routes.post(post.data.id)} />
    );
  }

  if (post.data.post_type === "SHARE") {
    return (
      <ForumSharePostDetail
        canInteract={canInteract}
        comments={comments}
        isPostRefetching={post.isRefetching}
        post={post.data}
        refetchPost={post.refetch}
      />
    );
  }

  return (
    <ForumPostFrame forumId={forumId}>
      <View className="min-h-0 flex-1 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:px-6 md:py-6">
        <CommentSection
          canInteract={canInteract}
          listHeader={
            <AskPostCard canInteract={canInteract} isDetail post={post.data} />
          }
          comments={comments}
          postId={post.data.id}
          renderList={(content) => (
            <FlatList
              {...content}
              className="flex-1"
              contentContainerClassName="mx-auto w-full max-w-[36rem] gap-3 pb-2"
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={post.isRefetching || comments.isRefetching}
                  onRefresh={() =>
                    void Promise.all([post.refetch(), comments.refetch()])
                  }
                />
              }
            />
          )}
        />
      </View>
    </ForumPostFrame>
  );
}

function ForumSharePostDetail({
  canInteract,
  comments,
  isPostRefetching,
  post,
  refetchPost,
}: {
  canInteract: boolean;
  comments: ReturnType<typeof useTopLevelComments>;
  isPostRefetching: boolean;
  post: PostWithDetails;
  refetchPost: ReturnType<typeof usePost>["refetch"];
}) {
  const entity = useEntity(post.entity_id ?? "");
  const user = useAuthUser();
  const score = useShareRatingScore(post.id, user?.id ?? "");

  if (entity.isLoading || score.isLoading) {
    return (
      <ForumPostFrame forumId={post.forum_id ?? ""}>
        <View className="min-h-0 flex-1 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:px-6 md:py-6">
          <View className="mx-auto w-full max-w-[36rem] gap-3">
            <PostCardSkeleton withMedia />
            <CommentListSkeleton />
          </View>
        </View>
      </ForumPostFrame>
    );
  }

  if (entity.isError || score.isError || !entity.data || score.data == null) {
    return (
      <ForumPostFrame forumId={post.forum_id ?? ""}>
        <FeedbackState
          actionLabel="Retry"
          onAction={() => void Promise.all([entity.refetch(), score.refetch()])}
          title="Couldn’t load this forum Share post."
          variant="error"
        />
      </ForumPostFrame>
    );
  }

  const sharePost: SharePostWithDetails = {
    ...post,
    ratingScore: score.data,
  };

  return (
    <ForumPostFrame forumId={post.forum_id ?? ""}>
      <View className="min-h-0 flex-1 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:px-6 md:py-6">
        <CommentSection
          canInteract={canInteract}
          listHeader={
            <SharePostCard
              canInteract={canInteract}
              isDetail
              post={sharePost}
              entity={entity.data}
            />
          }
          comments={comments}
          postId={post.id}
          renderList={(content) => (
            <FlatList
              {...content}
              className="flex-1"
              contentContainerClassName="mx-auto w-full max-w-[36rem] gap-3 pb-2"
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={
                    isPostRefetching ||
                    entity.isRefetching ||
                    score.isRefetching ||
                    comments.isRefetching
                  }
                  onRefresh={() =>
                    void Promise.all([
                      refetchPost(),
                      entity.refetch(),
                      score.refetch(),
                      comments.refetch(),
                    ])
                  }
                />
              }
            />
          )}
        />
      </View>
    </ForumPostFrame>
  );
}

function goBackToForum(forumId: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(routes.forum(forumId));
}

function ForumPostFrame({
  children,
  forumId,
}: {
  children: ReactNode;
  forumId: string;
}) {
  return (
    <PostDetailFrame
      onBack={() => goBackToForum(forumId)}
      showAccountActions={false}
      title="Forum post"
    >
      {children}
    </PostDetailFrame>
  );
}
