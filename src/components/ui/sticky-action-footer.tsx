import { View } from "react-native";

import { SafeAreaView } from "@/components/ui/safe-area-view";
import { cn } from "@/lib/utils";

type StickyActionFooterProps = React.ComponentProps<typeof View>;

function StickyActionFooter({
  children,
  className,
  ...props
}: StickyActionFooterProps) {
  return (
    <SafeAreaView className="border-t border-border bg-card" edges={["bottom"]}>
      <View
        className={cn(
          "mx-auto w-full max-w-2xl flex-row justify-end gap-3 px-6 py-4 sm:px-6",
          className,
        )}
        {...props}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

export type { StickyActionFooterProps };
export { StickyActionFooter };
