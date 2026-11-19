import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";

export function FindSearchSkeleton({
  leadingPin = false,
  rows = 2,
  className,
}: {
  leadingPin?: boolean;
  rows?: number;
  className?: string;
}) {
  const rowKeys = ["first", "second", "third"].slice(0, rows);

  return (
    <View
      accessibilityLabel="Loading Finds"
      className={`w-full ${className ?? "gap-2"}`}
    >
      {rowKeys.map((key) => (
        <View
          key={key}
          className="min-h-11 w-full flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
        >
          {leadingPin ? (
            <Skeleton className="size-5 shrink-0 rounded-full" />
          ) : null}
          <View className="min-w-0 flex-1 gap-0.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </View>
        </View>
      ))}
    </View>
  );
}
