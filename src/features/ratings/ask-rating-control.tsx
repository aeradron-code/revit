import { ChevronUp } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { selectionFeedback } from "@/lib/feedback";
import { useAuthUser } from "@/providers/auth-provider";
import { useMyAskRating, useSetMyAskRating } from "@/queries/ratings";
import { StarRating } from "@/features/ratings/star-rating";

const SCORES = [1, 2, 3, 4, 5] as const;

type AskRatingControlProps = {
  postId: string;
  onClose?: () => void;
};

export function AskRatingControl({ onClose, postId }: AskRatingControlProps) {
  const user = useAuthUser();
  const raterId = user?.id ?? "";
  const rating = useMyAskRating(postId, raterId);
  const setRating = useSetMyAskRating(postId, raterId);
  const currentScore = rating.data?.score ?? null;

  if (!user) return null;

  if (rating.error) {
    return (
      <View className="gap-2 border-t border-border bg-elevated px-5 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold">Your rating</Text>
          {onClose ? (
            <Button
              accessibilityLabel="Collapse rating options"
              className="p-0"
              hitSlop={8}
              onPress={onClose}
              size="icon"
              variant="ghost"
            >
              <Icon as={ChevronUp} className="size-4 text-muted-foreground" />
            </Button>
          ) : null}
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm" variant="muted">
            Your rating could not be loaded.
          </Text>
          <Button
            onPress={() => void rating.refetch()}
            size="xs"
            variant="link"
          >
            <Text className="text-sm">Try again</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="border-t border-border px-4 w-full gap-2.5 py-2 md:py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm">Your Rating</Text>
        {onClose ? (
          <Button
            accessibilityLabel="Collapse rating options"
            className="p-0 pr-2"
            hitSlop={8}
            onPress={onClose}
            size="icon"
            variant="ghost"
          >
            <Icon as={ChevronUp} className="size-4 text-muted-foreground" />
          </Button>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between">
        {rating.isLoading ? (
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-0.5">
              {SCORES.map((score) => (
                <Skeleton
                  key={score}
                  className="size-5 rounded-sm bg-secondary"
                />
              ))}
            </View>
            <Skeleton className="h-4 w-11 rounded-sm bg-secondary" />
          </View>
        ) : (
          <>
            <View className="flex-row items-center gap-3">
              <StarRating
                value={currentScore}
                disabled={setRating.isPending}
                starSize={20}
                gap={8}
                paddingHorizontal={0}
                paddingVertical={0}
                marginHorizontal={0}
                marginVertical={0}
                onChange={(score) => {
                  selectionFeedback();
                  setRating.mutate(score);
                }}
              />
              <Text className="text-xs font-medium" variant="muted">
                {currentScore === null ? "Not Rated" : `${currentScore}/5`}
              </Text>
            </View>

            {currentScore !== null ? (
              <Button
                accessibilityLabel="Clear your rating"
                disabled={setRating.isPending}
                onPress={() => {
                  selectionFeedback();
                  setRating.mutate(null);
                }}
                className="ml-auto p-0"
                size="icon"
                variant="link"
              >
                <Text className="text-xs text-primary">Clear rating</Text>
              </Button>
            ) : null}
          </>
        )}
      </View>

      {setRating.error ? (
        <Text className="text-xs text-destructive">
          {setRating.error.message}
        </Text>
      ) : null}
    </View>
  );
}
