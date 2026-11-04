import { Image } from "expo-image";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { AuthKeyboardScrollView } from "@/components/auth/auth-keyboard-scroll-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";

export function AuthScreenLayout({
  children,
  title,
  description,
  keyboardAware = false,
  showBrandGradient = false,
}: {
  children: ReactNode;
  title: string;
  description: string;
  keyboardAware?: boolean;
  showBrandGradient?: boolean;
}) {
  const FormScrollView = keyboardAware ? AuthKeyboardScrollView : ScrollView;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        enabled={!keyboardAware}
        className="flex-1"
        behavior={Platform.select({ ios: "padding", default: undefined })}
      >
        <FormScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={`flex-grow items-center justify-center bg-muted/30 px-5 py-10 sm:px-6 ${showBrandGradient ? "auth-brand-gradient" : ""}`}
        >
          <View className="w-full max-w-md gap-7">
            <View className="items-center gap-1.5">
              <Image
                source={require("../../../assets/expo.icon/Assets/revit-logo.svg")}
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
        </FormScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
