import type { ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "./keyboard-aware-scroll-view";

// Replace only the native list's scroll host. LegendList still owns cells,
// virtualization, refresh controls, metrics and its ref.
export function renderKeyboardAwareListScroll(props: ScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      {...props}
      automaticallyAdjustKeyboardInsets={false}
    />
  );
}
