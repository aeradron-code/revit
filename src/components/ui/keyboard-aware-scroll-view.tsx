import type { ComponentProps } from "react";
import { ScrollView } from "react-native";

// The browser manages focus scrolling and the virtual keyboard viewport.
export function KeyboardAwareScrollView({
  bottomOffset: _bottomOffset,
  ...props
}: ComponentProps<typeof ScrollView> & { bottomOffset?: number }) {
  return <ScrollView {...props} />;
}
