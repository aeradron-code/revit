import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";

export function FindSearchSkeleton({ rows = 2 }: { rows?: number }) {
  const rowKeys = ["first", "second", "third"].slice(0, rows);

  return (
    <View accessibilityLabel="Loading Finds" className="gap-2">
      {rowKeys.map((key) => (
        <View
          key={key}
          className="min-h-11 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
        >
          <Skeleton className="size-5 rounded-full" />
          <View className="min-w-0 flex-1 gap-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </View>
          <Skeleton className="size-4 rounded-sm" />
        </View>
      ))}
    </View>
  );
}
