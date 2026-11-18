import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton({
  withMedia = false,
}: {
  withMedia?: boolean;
}) {
  return (
    <View className="w-full gap-0 overflow-hidden rounded-none border-y border-border bg-card px-3 md:rounded-lg md:border">
      <View className="flex-row items-center gap-3 py-2">
        <Skeleton className="size-10 rounded-full" />
        <View className="min-w-0 flex-1 gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </View>
        <Skeleton className="h-5 w-14 rounded-full" />
      </View>
      <View className="gap-2 px-1">
        <View className="flex-row items-center gap-2">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-4 w-3/5" />
        </View>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        {withMedia ? <Skeleton className="h-36 w-full rounded-md" /> : null}
      </View>
      <View className="flex-row items-center gap-2 px-1 py-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </View>
    </View>
  );
}

export function PostFeedSkeleton({
  rows = 3,
  gapClassName = "gap-3",
}: {
  rows?: number;
  gapClassName?: string;
}) {
  const rowKeys = ["first", "second", "third", "fourth", "fifth"].slice(
    0,
    rows,
  );

  return (
    <View
      accessibilityLabel="Loading posts"
      className={`w-full ${gapClassName}`}
    >
      {rowKeys.map((key, index) => (
        <PostCardSkeleton key={key} withMedia={index % 2 === 0} />
      ))}
    </View>
  );
}
