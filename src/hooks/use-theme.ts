/**
 * Native navigation and utility-styled views both derive their palette from
 * Uniwind, so a single resolved theme drives the entire app.
 */

import { useUniwind } from "uniwind";

import { Colors } from "@/constants/theme";

export function useTheme() {
  const { theme } = useUniwind();

  return Colors[theme];
}
