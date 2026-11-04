import type { ComponentProps } from "react";
import { Platform, type ScrollView } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { withUniwind } from "uniwind";

const StyledKeyboardAwareScrollView = withUniwind(KeyboardAwareScrollView);

// Scope keyboard management to the sign-in/sign-up form, not other app screens.
export function AuthKeyboardScrollView(
  props: Omit<ComponentProps<typeof ScrollView>, "ref">,
) {
  return (
    <KeyboardProvider>
      <StyledKeyboardAwareScrollView
        {...props}
        bottomOffset={24}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      />
    </KeyboardProvider>
  );
}
