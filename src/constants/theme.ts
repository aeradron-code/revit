/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#12151A",
    background: "#FFFFFF",
    backgroundElement: "#FFFFFF",
    backgroundElevated: "#F1F3F6",
    backgroundSelected: "#EAF2FF",
    textSecondary: "#626875",
    textDisabled: "#9BA1AC",
    primary: "#3158B8",
    rating: "#D99A00",
    destructive: "#DC2626",
    success: "#16A34A",
    warning: "#D97706",
    border: "#D9DDE5",
    scrim: "#111318",
  },
  dark: {
    text: "#F5F7FA",
    background: "#090A0D",
    backgroundElement: "#111318",
    backgroundElevated: "#171A21",
    backgroundSelected: "#1B2536",
    textSecondary: "#9298A5",
    textDisabled: "#626875",
    primary: "#3158B8",
    rating: "#D99A00",
    destructive: "#EF4444",
    success: "#22C55E",
    warning: "#F59E0B",
    border: "#292D36",
    scrim: "#000000",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  micro: 4,
  related: 8,
  internal: 12,
  gutter: 16,
  section: 24,
  exceptional: 32,
} as const;

export const Radius = {
  control: 6,
  surface: 8,
  overlay: 12,
  avatar: 24,
} as const;

export const BottomTabInset = Platform.select({ ios: 54, android: 76 }) ?? 0;
export const MaxContentWidth = 960;
