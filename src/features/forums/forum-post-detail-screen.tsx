import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { RefreshControl, View } from "react-native";

import type { PostWithDetails } from "@/api/posts";
import type { SharePostWithDetails } from "@/api/shares";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { FeedbackState } from "@/components/ui/feedback-state";
import { CommentSection } from "@/features/comments/comment-section";
import { AskPostCard } from "@/features/posts/ask-post-card";
import { SharePostCard } from "@/features/posts/share-post-card";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useTopLevelComments } from "@/queries/comments";
import { useEntity } from "@/queries/entities";
import { usePost } from "@/queries/posts";
import { useShareRatingScore } from "@/queries/shares";
import { PostDetailFrame } from "@/features/posts/post-detail-frame";

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
  const post = usePost(postId, viewerId);
  const comments = useTopLevelComments(postId, { viewerId });

  if (post.isLoading) {
    return (
      <ForumPostFrame forumId={forumId}>
        <View className="w-full gap-4 px-4 py-6 md:mx-auto md:max-w-3xl md:px-6">
          <ContentSkeleton rows={3} />
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
        comments={comments}
        isPostRefetching={post.isRefetching}
        post={post.data}
        refetchPost={post.refetch}
      />
    );
  }

  return (
    <ForumPostFrame forumId={forumId}>
      <View className="flex-1 gap-4 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:gap-6 md:px-6 md:py-6">
        <AskPostCard isDetail post={post.data} />
        <CommentSection
          comments={comments}
          postId={post.data.id}
          refreshControl={
            <RefreshControl
              refreshing={post.isRefetching || comments.isRefetching}
              onRefresh={() =>
                void Promise.all([post.refetch(), comments.refetch()])
              }
            />
          }
        />
      </View>
    </ForumPostFrame>
  );
}

function ForumSharePostDetail({
  comments,
  isPostRefetching,
  post,
  refetchPost,
}: {
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
        <View className="w-full gap-4 px-4 py-6 md:mx-auto md:max-w-3xl md:px-6">
          <ContentSkeleton rows={3} />
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
      <View className="flex-1 gap-4 px-4 py-4 md:mx-auto md:w-full md:max-w-3xl md:gap-6 md:px-6 md:py-6">
        <SharePostCard isDetail post={sharePost} entity={entity.data} />
        <CommentSection
          comments={comments}
          postId={post.id}
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
