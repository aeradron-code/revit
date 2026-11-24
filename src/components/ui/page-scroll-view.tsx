import type { ComponentProps } from "react";
import { ScrollView } from "react-native";

import { cn } from "@/lib/utils";
import {
  pageContainerClassName,
  type PageWidth,
} from "@/components/ui/page-layout";

type PageScrollViewProps = ComponentProps<typeof ScrollView> & {
  contentContainerClassName?: string;
  contentWidth?: PageWidth;
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
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? "handled"}
      contentContainerClassName={cn(
        pageContainerClassName(contentWidth, "px-2 py-3 md:py-6"),
        contentContainerClassName,
      )}
    />
  );
}
