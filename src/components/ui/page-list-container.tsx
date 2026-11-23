import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";

import {
  pageContainerClassName,
  pageWidthStyle,
  type PageWidth,
} from "@/components/ui/page-layout";

/** Gives virtualized list rows one shared width, independent of the page header. */
export function PageListContainer({
  children,
  className,
  width = "content",
}: {
  children: ReactNode;
  className?: string;
  width?: PageWidth;
}) {
  const { width: viewportWidth } = useWindowDimensions();

  return (
    <View
      className={pageContainerClassName(width, className)}
      style={pageWidthStyle(width, viewportWidth)}
    >
      {children}
    </View>
  );
}
