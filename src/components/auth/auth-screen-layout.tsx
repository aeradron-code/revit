import { Image } from "expo-image";
import type { ReactNode } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/keyboard-aware-scroll-view";
import { pageContainerClassName } from "@/components/ui/page-layout";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";

export function AuthScreenLayout({
  children,
  title,
  description,
  showBrandGradient = false,
}: {
  children: ReactNode;
  title: string;
  description: string;
  showBrandGradient?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerClassName={`flex-grow items-center justify-center bg-muted/30 px-5 pt-10 pb-24 sm:px-6 ${showBrandGradient ? "auth-brand-gradient" : ""}`}
      >
        <View className={pageContainerClassName("auth", "gap-7")}>
          <View className="items-center gap-1.5">
            <Image
              source={require("../../../assets/images/revit-logo.svg")}
              style={{ width: 64, height: 64 }}
              contentFit="contain"
              accessibilityLabel="Revit"
            />
            <Text variant="muted">Good finds. Trusted opinions.</Text>
          </View>

          <View className="gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <View className="gap-1 pt-1 pb-2">
              <Text variant="h1" className="text-left">
                {title}
              </Text>
              <Text variant="muted" className="text-sm leading-5">
                {description}
              </Text>
            </View>
            {children}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
