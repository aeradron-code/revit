import { Link } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";

import type { PostWithDetails } from "@/api/posts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { InlineCommentDrawer } from "@/features/comments/inline-comment-drawer";
import { AskRatingControl } from "@/features/ratings/ask-rating-control";
import { routes } from "@/lib/routes";

import { PostEngagementActions } from "./post-engagement-actions";
import { PostAuthorHeader } from "./post-author-header";
import { PostMediaGallery } from "./post-media-gallery";

type AskPostCardProps = {
  canInteract?: boolean;
  isDetail?: boolean;
  ownerActions?: ReactNode;
  post: PostWithDetails;
};

export function AskPostCard({
  isDetail = false,
  canInteract = true,
  post,
  ownerActions,
}: AskPostCardProps) {
  const [expandedDrawer, setExpandedDrawer] = useState<
    "comments" | "rating" | null
  >(null);
  const isRatingExpanded = expandedDrawer === "rating";
  const isCommentsExpanded = expandedDrawer === "comments";
  const postHref = post.forum_id
    ? routes.forumPost(post.forum_id, post.id)
    : routes.post(post.id);
  const postContent = (
    <View className="gap-2">
      <View className="gap-1 px-2">
        {post.body ? (
          <Text className="text-sm leading-5">{post.body}</Text>
        ) : null}
      </View>
      <PostMediaGallery media={post.media} />
    </View>
  );

  return (
    <Card className="mx-auto w-full max-w-xl self-center gap-0 overflow-hidden rounded-none border-x-0 pb-0 pt-0 md:rounded-lg md:border">
      <CardHeader className="md:pt-3 pt-2.5 pb-2">
        <PostAuthorHeader
          author={post.author}
          createdAt={post.created_at}
          postId={post.id}
          trailingContent={
            <View className="flex-row items-center gap-1">
              <Badge className="rounded-full px-2 py-0.5" variant="default">
                <Text className="text-[9px] font-semibold">ASK</Text>
              </Badge>
              {ownerActions}
            </View>
          }
        />
      </CardHeader>

      <CardContent className="gap-2 px-0">
        {isDetail ? (
          postContent
        ) : (
          <Link href={postHref} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open post by ${post.author.display_name}`}
              className="gap-2 active:opacity-90"
            >
              {postContent}
            </Pressable>
          </Link>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start w-full px-0">
        <View className="flex-row items-start p-2">
          <PostEngagementActions
            commentsExpanded={!isDetail && isCommentsExpanded}
            canInteract={canInteract}
            forumId={post.forum_id}
            isDetail={isDetail}
            onCommentPress={
              isDetail
                ? undefined
                : () =>
                    setExpandedDrawer((drawer) =>
                      drawer === "comments" ? null : "comments",
                    )
            }
            onRatingPress={() =>
              setExpandedDrawer((drawer) =>
                drawer === "rating" ? null : "rating",
              )
            }
            postId={post.id}
            ratingExpanded={isRatingExpanded}
            engagement={post.engagement}
          />
        </View>
        {isRatingExpanded && canInteract ? (
          <AskRatingControl
            onClose={() => setExpandedDrawer(null)}
            postId={post.id}
          />
        ) : null}
        {!isDetail && isCommentsExpanded && canInteract ? (
          <InlineCommentDrawer postId={post.id} />
        ) : null}
      </CardFooter>
    </Card>
  );
}
