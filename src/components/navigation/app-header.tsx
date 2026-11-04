import { ArrowLeft, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";

import { HeaderActions } from "./header-actions";

type AppHeaderProps = {
  leading?: "back" | "close" | "none";
  onBack?: () => void;
  onLeadingPress?: () => void;
  showAccountActions?: boolean;
  title: string;
  titleAlign?: "left" | "center";
  trailing?: ReactNode;
};

export function AppHeader({
  leading = "none",
  onBack,
  onLeadingPress,
  showAccountActions = false,
  title,
  titleAlign = "left",
  trailing,
}: AppHeaderProps) {
  const resolvedLeading = onBack && leading === "none" ? "back" : leading;
  const handleLeadingPress = onLeadingPress ?? onBack;
  const LeadingIcon = resolvedLeading === "close" ? X : ArrowLeft;
  const leadingControl =
    resolvedLeading !== "none" && handleLeadingPress ? (
      <Button
        accessibilityLabel={resolvedLeading === "close" ? "Close" : "Go back"}
        onPress={handleLeadingPress}
        size="icon"
        variant="ghost"
      >
        <Icon as={LeadingIcon} className="size-6 text-foreground" />
      </Button>
    ) : null;
  const trailingContent =
    trailing ?? (showAccountActions ? <HeaderActions /> : null);

  return (
    <SafeAreaView className="bg-card" edges={["top"]}>
      <View className="h-14 flex-row items-center border-b border-border bg-card px-3">
        {titleAlign === "center" ? (
          <>
            <View className="min-w-12 flex-1 items-start">
              {leadingControl}
            </View>
            <Text
              className="shrink text-center text-xl font-semibold"
              numberOfLines={1}
            >
              {title}
            </Text>
            <View className="min-w-12 flex-1 items-end">{trailingContent}</View>
          </>
        ) : (
          <>
            {leadingControl}
            <Text
              className="min-w-0 flex-1 truncate px-2 text-xl font-semibold"
              numberOfLines={1}
            >
              {title}
            </Text>
            {trailingContent ? (
              <View className="items-end">{trailingContent}</View>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
