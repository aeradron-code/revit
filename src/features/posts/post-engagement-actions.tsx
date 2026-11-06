import { Link } from "expo-router";
import { MessageCircle, Star } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useCommentCount } from "@/queries/comments";
import { useAskRatingSummary } from "@/queries/ratings";

type PostEngagementActionsProps = {
  postId: string;
  forumId?: string | null;
  isDetail?: boolean;
  canInteract?: boolean;
  commentsExpanded?: boolean;
  onCommentPress?: () => void;
  onRatingPress?: () => void;
  ratingExpanded?: boolean;
  engagement?: {
    averageScore: number | null;
    commentCount: number;
    ratingCount: number;
  };
};

export function PostEngagementActions({
  commentsExpanded = false,
  forumId,
  isDetail = false,
  canInteract = true,
  onCommentPress,
  onRatingPress,
  postId,
  ratingExpanded = false,
  engagement,
}: PostEngagementActionsProps) {
  const user = useAuthUser();
  const theme = useTheme();
  const viewerId = user?.id ?? "";
  const rating = useAskRatingSummary(postId, viewerId, !engagement);
  const comments = useCommentCount(postId, viewerId, !engagement);
  const averageScore =
    engagement?.averageScore ?? rating.data?.averageScore ?? null;
  const commentCount = engagement?.commentCount ?? comments.data ?? 0;
  const ratingLoading = !engagement && (rating.isLoading || rating.isError);
  const commentsLoading =
    !engagement && (comments.isLoading || comments.isError);

  return (
    <View className="flex-1 flex-row items-center gap-1">
      {onRatingPress ? (
        <Button
          accessibilityLabel="Rate this post"
          accessibilityState={{ expanded: ratingExpanded }}
          disabled={!canInteract}
          className={`gap-1.5 border px-3 ${ratingExpanded ? "border-primary bg-selected" : "border-transparent"}`}
          onPress={onRatingPress}
          variant="ghost"
        >
          <Icon
            as={Star}
            className={
              ratingLoading
                ? "size-4 text-muted-foreground"
                : "size-4 text-rating"
            }
            fill={averageScore === null ? "none" : theme.rating}
            stroke={theme.rating}
            strokeWidth={averageScore === null ? 1.8 : 0}
          />
          <Text className="text-[13px] font-medium">
            {ratingLoading ? "—" : (averageScore?.toFixed(1) ?? "0.0")}
          </Text>
        </Button>
      ) : (
        <View className="flex-row items-center gap-1.5">
          <Icon
            as={Star}
            className={
              ratingLoading
                ? "size-4 text-muted-foreground"
                : "size-4 text-rating"
            }
            fill={averageScore === null ? "none" : theme.rating}
            stroke={theme.rating}
            strokeWidth={averageScore === null ? 1.8 : 0}
          />
          <Text className="text-[13px] font-medium">
            {ratingLoading ? "—" : (averageScore?.toFixed(1) ?? "0.0")}
          </Text>
        </View>
      )}
      {onCommentPress ? (
        <Button
          accessibilityLabel={
            commentsLoading
              ? "Comments unavailable"
              : `View ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`
          }
          accessibilityState={{ expanded: commentsExpanded }}
          disabled={!canInteract}
          className={`h-8 gap-1.5 border ${commentsExpanded ? "border-primary bg-selected" : "border-transparent"}`}
          onPress={onCommentPress}
          variant="ghost"
        >
          <Icon as={MessageCircle} className="size-4 text-muted-foreground" />
          <Text className="text-[13px] font-medium text-muted-foreground">
            {commentsLoading ? "—" : commentCount}
          </Text>
        </Button>
      ) : isDetail ? (
        <View
          accessibilityLabel={`View ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
          accessibilityRole="text"
          className="min-h-10 flex-row items-center gap-1.5 rounded-md px-4 py-2.5"
        >
          <Icon as={MessageCircle} className="size-4 text-muted-foreground" />
          <Text className="text-[13px] font-medium text-muted-foreground">
            {commentsLoading ? "—" : commentCount}
          </Text>
        </View>
      ) : (
        <Link
          href={
            forumId ? routes.forumPost(forumId, postId) : routes.post(postId)
          }
          asChild
        >
          <Button
            accessibilityLabel={
              commentsLoading
                ? "Comments unavailable"
                : `View ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`
            }
            className="gap-1.5"
            size="xs"
            variant="ghost"
          >
            <Icon as={MessageCircle} className="size-4 text-muted-foreground" />
            <Text className="text-[13px] font-medium text-muted-foreground">
              {commentsLoading ? "—" : commentCount}
            </Text>
          </Button>
        </Link>
      )}
    </View>
  );
}
