import { forwardRef, type ComponentRef } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import type {
  Edge,
  EdgeRecord,
  SafeAreaViewProps,
} from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

const allEdges: Edge[] = ["top", "right", "bottom", "left"];

const WebSafeAreaView = forwardRef<
  ComponentRef<typeof View>,
  SafeAreaViewProps
>(({ edges = allEdges, mode = "padding", style, ...props }, ref) => {
  const flat = StyleSheet.flatten(style) ?? {};
  const spacing: Record<string, string> = {};

  for (const edge of allEdges) {
    const edgeMode = Array.isArray(edges)
      ? edges.includes(edge)
        ? "additive"
        : "off"
      : ((edges as EdgeRecord)[edge] ?? "off");
    if (edgeMode === "off") continue;

    const side =
      `${mode}${edge[0].toUpperCase()}${edge.slice(1)}` as keyof ViewStyle;
    const axis =
      `${mode}${edge === "top" || edge === "bottom" ? "Vertical" : "Horizontal"}` as keyof ViewStyle;
    const base = flat[side] ?? flat[axis] ?? flat[mode] ?? 0;
    const value = typeof base === "number" ? `${base}px` : String(base);
    const inset = `env(safe-area-inset-${edge}, 0px)`;
    spacing[side] =
      edgeMode === "maximum"
        ? `max(${value}, ${inset})`
        : `calc(${value} + ${inset})`;
  }

  // React Native Web accepts CSS lengths, while native ViewStyle only types numbers.
  return <View {...props} ref={ref} style={[style, spacing as ViewStyle]} />;
});

WebSafeAreaView.displayName = "WebSafeAreaView";

const SafeAreaView = withUniwind(WebSafeAreaView);

export { SafeAreaView };
