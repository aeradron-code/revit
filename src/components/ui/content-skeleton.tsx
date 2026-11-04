import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";

export function ContentSkeleton({ rows = 3 }: { rows?: number }) {
  const rowKeys = ["first", "second", "third", "fourth", "fifth"].slice(
    0,
    rows,
  );

  return (
    <View accessibilityLabel="Loading content" className="gap-3">
      {rowKeys.map((rowKey) => (
        <View
          key={rowKey}
          className="gap-2 rounded-lg border border-border bg-card p-3"
        >
          <View className="flex-row items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <View className="flex-1 gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </View>
          </View>
          <Skeleton className="h-3 w-4/5" />
        </View>
      ))}
    </View>
  );
}
