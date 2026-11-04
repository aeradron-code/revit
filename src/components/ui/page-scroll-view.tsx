import type { ComponentProps } from "react";
import { ScrollView } from "react-native";

import { cn } from "@/lib/utils";

type ContentWidth = "narrow" | "standard" | "wide" | "profile";

type PageScrollViewProps = ComponentProps<typeof ScrollView> & {
  contentContainerClassName?: string;
  contentWidth?: ContentWidth;
};

const contentWidths: Record<ContentWidth, string> = {
  narrow: "md:max-w-2xl",
  standard: "md:max-w-3xl",
  wide: "md:max-w-3xl",
  profile: "md:max-w-4xl",
};

/**
 * The common page canvas for scrollable app screens. Mobile pages use one
 * measured gutter; content width and centering begin only on larger screens.
 */
export function PageScrollView({
  contentContainerClassName,
  contentWidth = "standard",
  ...props
}: PageScrollViewProps) {
  return (
    <ScrollView
      {...props}
      contentContainerClassName={cn(
        "w-full px-2 py-3 md:mx-auto md:py-6",
        contentWidths[contentWidth],
        contentContainerClassName,
      )}
    />
  );
}
