import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton({
  kind = "share",
  withMedia = false,
}: {
  kind?: "ask" | "share";
  withMedia?: boolean;
}) {
  return (
    <View className="w-full gap-0 overflow-hidden rounded-none border-y border-border bg-card px-3 md:rounded-lg md:border">
      <View className="flex-row items-center gap-3 py-2">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <View className="min-w-0 flex-1 gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </View>
        <Skeleton className="h-5 w-14 rounded-full" />
      </View>
      <View className="w-full gap-2 px-1">
        {kind === "share" ? (
          <View className="w-full flex-row items-center gap-2">
            <Skeleton className="size-5 shrink-0 rounded-sm" />
            <View className="min-w-0 flex-1 gap-1">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </View>
            <View className="flex-row gap-1">
              {["one", "two", "three", "four", "five"].map((star) => (
                <Skeleton key={star} className="size-4 rounded-sm" />
              ))}
            </View>
          </View>
        ) : null}
        <View className="w-full gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </View>
        {withMedia ? (
          <Skeleton className="w-full rounded-md" style={{ aspectRatio: 1 }} />
        ) : null}
      </View>
      <View className="w-full flex-row items-center gap-2 px-1 py-2">
        {kind === "ask" ? <Skeleton className="h-8 w-20 rounded-md" /> : null}
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
  const rowKinds = ["share", "share", "ask", "share", "ask"] as const;
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
        <PostCardSkeleton
          key={key}
          kind={rowKinds[index] ?? "share"}
          withMedia={index === 0}
        />
      ))}
    </View>
  );
}
