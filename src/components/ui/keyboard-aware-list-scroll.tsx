import type { ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "./keyboard-aware-scroll-view";

// Replace only the list's scroll host. FlatList still owns cells, virtualization,
// refresh controls, metrics and its ref. Insets mode adds no extra layout child.
export function renderKeyboardAwareListScroll(props: ScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      {...props}
      automaticallyAdjustKeyboardInsets={false}
    />
  );
}
