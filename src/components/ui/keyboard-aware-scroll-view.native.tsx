import type { ComponentProps } from "react";
import { Platform } from "react-native";
import { KeyboardAwareScrollView as NativeKeyboardAwareScrollView } from "react-native-keyboard-controller";
import { withUniwind } from "uniwind";

const StyledKeyboardAwareScrollView = withUniwind(
  NativeKeyboardAwareScrollView,
);

export function KeyboardAwareScrollView({
  bottomOffset = 24,
  keyboardDismissMode = Platform.OS === "ios" ? "interactive" : "on-drag",
  keyboardShouldPersistTaps = "handled",
  ...props
}: ComponentProps<typeof NativeKeyboardAwareScrollView>) {
  return (
    <StyledKeyboardAwareScrollView
      {...props}
      bottomOffset={bottomOffset}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    />
  );
}
