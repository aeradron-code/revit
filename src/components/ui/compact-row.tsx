import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type CompactRowProps = React.ComponentProps<typeof View> & {
  description?: string;
  leading?: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
};

function CompactRow({
  className,
  description,
  leading,
  title,
  trailing,
  ...props
}: CompactRowProps) {
  return (
    <View
      className={cn(
        "min-h-12 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
      {...props}
    >
      {leading}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text variant="muted" numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export type { CompactRowProps };
export { CompactRow };
