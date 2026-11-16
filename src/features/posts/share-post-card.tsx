import { Link } from "expo-router";
import { MapPin, MessageCircle } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { Entity } from "@/api/entities";
import type { SharePostWithDetails } from "@/api/shares";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/theme";
import { InlineCommentDrawer } from "@/features/comments/inline-comment-drawer";
import { StarRating } from "@/features/ratings/star-rating";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useCommentCount } from "@/queries/comments";

import { PostMediaGallery } from "./post-media-gallery";
import { PostAuthorHeader } from "./post-author-header";

type SharePostCardProps = {
  canInteract?: boolean;
  isDetail?: boolean;
  post: SharePostWithDetails;
  entity: Entity;
};

export function SharePostCard({
  canInteract = true,
  isDetail = false,
  post,
  entity,
}: SharePostCardProps) {
  const user = useAuthUser();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const comments = useCommentCount(post.id, user?.id ?? "", !post.engagement);
  const commentCount = post.engagement?.commentCount ?? comments.data ?? 0;
  const commentsLoading =
    !post.engagement && (comments.isLoading || comments.isError);
  const postHref = post.forum_id
    ? routes.forumPost(post.forum_id, post.id)
    : routes.post(post.id);
  const postContent = (
    <View className="gap-2">
      <View className="px-2">
        {post.body ? (
          <Text className="text-sm leading-5">{post.body}</Text>
        ) : null}
      </View>
      <PostMediaGallery media={post.media} />
    </View>
  );

  return (
    <Card className="mx-auto w-full max-w-[36rem] self-center gap-0 overflow-hidden rounded-none border-x-0 pb-0 pt-0 md:rounded-lg md:border">
      <CardHeader className="md:pt-3 py-2">
        <PostAuthorHeader
          author={post.author}
          createdAt={post.created_at}
          postId={post.id}
          trailingContent={
            <Badge className="rounded-full px-2 py-0.5" variant="default">
              <Text className="text-[9px] font-semibold">SHARE</Text>
            </Badge>
          }
        />
      </CardHeader>
      <CardContent className="gap-2 px-0">
        <Link
          href={routes.entity(entity.id)}
          asChild
          className="px-2 md:px-3 md:pt-1 py-0"
        >
          <Button
            accessibilityRole="link"
            className="flex flex-row gap-2 items-center"
            accessibilityLabel={`View ${entity.name}`}
            size="content"
            variant="ghost"
          >
            <Icon as={MapPin} className="size-5" color={Colors.light.primary} />
            <View className="flex-1 items-start gap-0.5">
              <Text className="text-[14px] font-semibold" numberOfLines={1}>
                {entity.name}
              </Text>
              <Text
                className="text-xs text-muted-foreground"
                variant="muted"
                numberOfLines={1}
              >
                {[entity.category.label, entity.locality]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <StarRating
              value={post.ratingScore}
              readOnly
              allowHalf
              animated={false}
              starSize={16}
              gap={5}
            />
          </Button>
        </Link>

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
        <View className="w-full flex-row items-center justify-start px-2 py-2">
          <View className="flex-1 flex-row items-center gap-3">
            {isDetail ? (
              <View className="min-h-10 flex-row items-center gap-1.5 rounded-md px-4 py-2.5">
                <Icon
                  as={MessageCircle}
                  className="size-4 text-muted-foreground"
                />
                <Text className="text-[13px] font-medium text-muted-foreground">
                  {commentsLoading ? "—" : commentCount}
                </Text>
              </View>
            ) : (
              <Button
                accessibilityLabel={`View ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
                accessibilityState={{ expanded: commentsExpanded }}
                disabled={!canInteract}
                className={`h-8 gap-1.5 border ${commentsExpanded ? "border-primary bg-selected" : "border-transparent"}`}
                variant="ghost"
                onPress={() => {
                  if (canInteract) {
                    setCommentsExpanded((expanded) => !expanded);
                  }
                }}
              >
                <Icon
                  as={MessageCircle}
                  className="size-4 text-muted-foreground"
                />
                <Text className="text-[13px] font-medium text-muted-foreground">
                  {commentsLoading ? "—" : commentCount}
                </Text>
              </Button>
            )}
          </View>
        </View>
        {!isDetail && commentsExpanded && canInteract ? (
          <InlineCommentDrawer postId={post.id} />
        ) : null}
      </CardFooter>
    </Card>
  );
}
