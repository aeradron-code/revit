import type { ReactNode } from "react";
import { View } from "react-native";

import {
  pageContainerClassName,
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
  return (
    <View className={pageContainerClassName(width, className)}>{children}</View>
  );
}
