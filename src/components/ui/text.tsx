import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText, type Role } from "react-native";
import { cn } from "@/lib/utils";

const textVariants = cva(
  cn(
    "text-foreground text-[15px] leading-5",
    Platform.select({
      web: "select-text",
    }),
  ),
  {
    variants: {
      variant: {
        default: "",
        h1: cn(
          "text-[24px] font-bold leading-[30px] tracking-[-0.02em]",
          Platform.select({ web: "scroll-m-20 text-balance" }),
        ),
        h2: cn(
          "text-[18px] font-semibold leading-6 tracking-[-0.02em]",
          Platform.select({ web: "scroll-m-20 first:mt-0" }),
        ),
        h3: cn(
          "text-xl font-semibold leading-7 tracking-[-0.01em]",
          Platform.select({ web: "scroll-m-20" }),
        ),
        h4: cn(
          "text-lg font-semibold leading-6",
          Platform.select({ web: "scroll-m-20" }),
        ),
        p: "leading-6",
        blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
        code: cn(
          "bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        ),
        lead: "text-muted-foreground text-lg leading-6",
        large: "text-lg font-semibold leading-6",
        small: "text-sm font-medium leading-5",
        muted: "text-muted-foreground text-[13px] leading-[18px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps["variant"]>;

type TextProps = React.ComponentPropsWithoutRef<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  };

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  blockquote: Platform.select({ web: "blockquote" as Role }),
  code: Platform.select({ web: "code" as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: "1",
  h2: "2",
  h3: "3",
  h4: "4",
};

const TextClassContext = React.createContext<string | undefined>(undefined);

const Text = React.forwardRef<React.ElementRef<typeof RNText>, TextProps>(
  function Text({ className, asChild = false, variant, ...props }, ref) {
    const textClass = React.useContext(TextClassContext);
    const Component = asChild ? Slot : RNText;
    const resolvedVariant = variant ?? "default";
    const variantClasses = textVariants({ variant: resolvedVariant });
    const classes =
      variant && variant !== "default"
        ? cn(textClass, variantClasses, className)
        : cn(variantClasses, textClass, className);

    return (
      <Component
        ref={ref}
        className={classes}
        role={ROLE[resolvedVariant]}
        aria-level={ARIA_LEVEL[resolvedVariant]}
        {...props}
      />
    );
  },
);

Text.displayName = "Text";

export { Text, TextClassContext };
