import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type FeedbackStateProps = React.ComponentProps<typeof View> & {
  actionLabel?: string;
  description?: string;
  onAction?: () => void;
  title: string;
  variant?: "empty" | "error";
};

function FeedbackState({
  actionLabel,
  className,
  description,
  onAction,
  title,
  variant = "empty",
  ...props
}: FeedbackStateProps) {
  if (variant === "error") {
    return (
      <View
        className={cn(
          "min-h-11 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-2",
          className,
        )}
        {...props}
      >
        <Text className="min-w-0 flex-1 text-sm">{title}</Text>
        {actionLabel && onAction ? (
          <Button size="sm" variant="ghost" onPress={onAction}>
            <Text>{actionLabel}</Text>
          </Button>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className={cn(
        "justify-center gap-1 rounded-lg border border-border bg-card px-3 py-4",
        className,
      )}
      {...props}
    >
      <Text className="text-sm font-semibold">{title}</Text>
      {description ? <Text variant="muted">{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          className="mt-2 self-start"
          size="sm"
          variant="ghost"
          onPress={onAction}
        >
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}

export type { FeedbackStateProps };
export { FeedbackState };
