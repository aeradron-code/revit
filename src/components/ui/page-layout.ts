import { cn } from "@/lib/utils";

export type PageWidth =
  | "content"
  | "compact"
  | "auth"
  | "narrow"
  | "standard"
  | "wide"
  | "profile"
  | "extraWide"
  | "feed"
  | "full";

const pageWidths: Record<PageWidth, { className: string; maxWidth?: number }> =
  {
    content: { className: "md:max-w-[38rem]", maxWidth: 608 },
    compact: { className: "md:max-w-lg", maxWidth: 512 },
    auth: { className: "md:max-w-md", maxWidth: 448 },
    narrow: { className: "md:max-w-2xl", maxWidth: 672 },
    standard: { className: "md:max-w-3xl", maxWidth: 768 },
    wide: { className: "md:max-w-5xl", maxWidth: 1024 },
    profile: { className: "md:max-w-4xl", maxWidth: 896 },
    extraWide: { className: "md:max-w-6xl", maxWidth: 1152 },
    feed: { className: "md:max-w-[40rem]", maxWidth: 640 },
    full: { className: "" },
  };

export function pageWidthMaxWidth(width: PageWidth) {
  return pageWidths[width].maxWidth;
}

/** Inline responsive width rule shared by list viewports and list rows. */
export function pageWidthStyle(width: PageWidth, viewportWidth: number) {
  if (viewportWidth < 768) return undefined;

  return {
    marginLeft: "auto" as const,
    marginRight: "auto" as const,
    maxWidth: pageWidthMaxWidth(width),
    width: "100%" as const,
  };
}

/** Shared width and centering rules for page-level content on larger screens. */
export function pageContainerClassName(
  width: PageWidth = "standard",
  className?: string,
) {
  return cn("w-full md:mx-auto", pageWidths[width].className, className);
}
