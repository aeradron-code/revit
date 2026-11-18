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
  | "full";

const pageWidths: Record<PageWidth, string> = {
  content: "md:max-w-[36rem]",
  compact: "md:max-w-lg",
  auth: "md:max-w-md",
  narrow: "md:max-w-2xl",
  standard: "md:max-w-3xl",
  wide: "md:max-w-5xl",
  profile: "md:max-w-4xl",
  extraWide: "md:max-w-6xl",
  full: "",
};

/** Shared width and centering rules for page-level content on larger screens. */
export function pageContainerClassName(
  width: PageWidth = "standard",
  className?: string,
) {
  return cn("w-full md:mx-auto", pageWidths[width], className);
}
