import { DarkTheme, DefaultTheme, type Theme } from "expo-router";

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: "hsl(0 0% 100%)",
      border: "hsl(0 0% 89.8%)",
      card: "hsl(0 0% 100%)",
      notification: "hsl(225 58% 46%)",
      primary: "hsl(225 58% 46%)",
      text: "hsl(0 0% 3.9%)",
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: "hsl(0 0% 3.9%)",
      border: "hsl(0 0% 14.9%)",
      card: "hsl(0 0% 3.9%)",
      notification: "hsl(225 66% 64%)",
      primary: "hsl(225 66% 64%)",
      text: "hsl(0 0% 98%)",
    },
  },
};
