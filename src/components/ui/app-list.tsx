import { LegendList, type LegendListProps } from "@legendapp/list/react-native";
import { cn } from "@/lib/utils";
import { Platform, StyleSheet, useWindowDimensions } from "react-native";
import { withUniwind } from "uniwind";

import { renderKeyboardAwareListScroll } from "@/components/ui/keyboard-aware-list-scroll";
import {
  pageWidthStyle,
  type PageWidth,
} from "@/components/ui/page-layout";

type ContentGap = number | { base: number; md?: number };

export type AppListProps<ItemT> = Omit<
  LegendListProps<ItemT>,
  "renderScrollComponent"
> & {
  className?: string;
  contentContainerClassName?: string;
  /** Shared maximum width for list content; the scroll viewport stays full width. */
  contentWidth?: PageWidth;
  /** Gap between the list header, rows, and footer, in logical pixels. */
  contentGap?: ContentGap;
};

type StyledLegendListProps<ItemT> = AppListProps<ItemT> &
  Pick<LegendListProps<ItemT>, "renderScrollComponent">;

const NativeLegendList = withUniwind(LegendList) as unknown as <ItemT>(
  props: StyledLegendListProps<ItemT>,
) => React.ReactElement | null;
const WebLegendList = LegendList as unknown as <ItemT>(
  props: AppListProps<ItemT>,
) => React.ReactElement | null;

/**
 * Shared virtualized list surface for app screens.
 *
 * The scroll viewport always fills its parent. Width constraints and page
 * gutters belong to the content container so they cannot inset the scrollbar.
 * Native retains the keyboard-aware scroll host; web uses LegendList's own host.
 */
export function AppList<ItemT>({
  className,
  contentContainerClassName,
  contentWidth,
  contentContainerStyle,
  contentGap,
  recycleItems,
  showsVerticalScrollIndicator,
  ...props
}: AppListProps<ItemT>) {
  const { width } = useWindowDimensions();
  const showVerticalScrollIndicator =
    showsVerticalScrollIndicator ?? (Platform.OS === "web" && width >= 768);
  const gap =
    typeof contentGap === "number"
      ? contentGap
      : contentGap
        ? width >= 768
          ? (contentGap.md ?? contentGap.base)
          : contentGap.base
        : undefined;

  const listClassName = cn("min-h-0 w-full flex-1", className);
  const contentClassName = cn(
    "w-full",
    contentContainerClassName,
  );
  const contentWidthStyle = contentWidth
    ? pageWidthStyle(contentWidth, width)
    : undefined;
  const mergedContentStyle = [
    gap === undefined ? undefined : { gap },
    contentWidthStyle,
    contentContainerStyle,
  ];
  const sharedProps = {
    ...props,
    className: listClassName,
    contentContainerClassName: contentClassName,
    recycleItems: recycleItems ?? false,
    showsVerticalScrollIndicator: showVerticalScrollIndicator,
  };

  if (Platform.OS === "web") {
    const {
      keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
      ...webProps
    } = sharedProps;

    return (
      <WebLegendList<ItemT>
        {...webProps}
        contentContainerStyle={StyleSheet.flatten(mergedContentStyle)}
      />
    );
  }

  return (
    <NativeLegendList<ItemT>
      {...sharedProps}
      contentContainerStyle={mergedContentStyle}
      renderScrollComponent={renderKeyboardAwareListScroll}
    />
  );
}
