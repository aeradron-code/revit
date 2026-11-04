import type { ComponentProps } from "react";
import { ScrollView } from "react-native";

// Browsers manage focus scrolling and their own virtual keyboard viewport.
export function AuthKeyboardScrollView(
  props: ComponentProps<typeof ScrollView>,
) {
  return <ScrollView {...props} />;
}
