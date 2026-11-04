import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Pressable } from "react-native";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  cn(
    "group shrink-0 flex-row items-center justify-center gap-2 rounded-md active:opacity-90",
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    }),
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary active:bg-primary/80",
          Platform.select({ web: "hover:bg-primary/90" }),
        ),
        destructive: cn(
          "bg-destructive active:bg-destructive/90",
          Platform.select({
            web: "hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
          }),
        ),
        outline: cn(
          "border-primary bg-transparent active:bg-selected border",
          Platform.select({
            web: "hover:bg-selected",
          }),
        ),
        secondary: cn(
          "bg-elevated active:bg-selected",
          Platform.select({ web: "hover:bg-selected" }),
        ),
        ghost: cn(
          "active:bg-selected",
          Platform.select({ web: "hover:bg-selected" }),
        ),
        link: "",
      },
      size: {
        default: cn(
          "min-h-10 px-4 py-2.5",
          Platform.select({ web: "has-[>svg]:px-4" }),
        ),
        sm: cn(
          "min-h-9 gap-1.5 rounded-md px-3 py-2",
          Platform.select({ web: "has-[>svg]:px-2.5" }),
        ),
        xs: "min-h-8 gap-1.5 rounded-md px-2 py-1.5",
        lg: cn(
          "min-h-12 rounded-lg px-5 py-2.5",
          Platform.select({ web: "has-[>svg]:px-5" }),
        ),
        icon: "p-3.5",
        rating: "min-h-11 min-w-8 px-1 py-2",
        content: "min-h-12 h-auto justify-start px-3 py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva(
  cn(
    "text-foreground text-sm font-medium",
    Platform.select({ web: "pointer-events-none transition-colors" }),
  ),
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        destructive: "text-white",
        outline: "text-primary dark:text-foreground",
        secondary: "text-foreground",
        ghost: "text-primary dark:text-foreground",
        link: cn(
          "text-primary dark:text-foreground group-active:underline",
          Platform.select({
            web: "underline-offset-4 hover:underline group-hover:underline",
          }),
        ),
      },
      size: {
        default: "",
        sm: "",
        xs: "text-xs leading-4",
        lg: "",
        icon: "",
        rating: "",
        content: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(function Button({ className, variant, size, ...props }, ref) {
  const resolvedVariant = variant ?? "default";
  const disabledClass =
    resolvedVariant === "default"
      ? "border-transparent bg-selected"
      : resolvedVariant === "destructive"
        ? "bg-destructive/60"
        : "opacity-50";

  return (
    <TextClassContext.Provider
      value={cn(
        buttonTextVariants({ variant: resolvedVariant, size }),
        props.disabled && "text-disabled",
      )}
    >
      <Pressable
        ref={ref}
        className={cn(
          buttonVariants({ variant: resolvedVariant, size }),
          props.disabled && disabledClass,
          className,
        )}
        role="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
});

Button.displayName = "Button";

export type { ButtonProps };
export { Button, buttonTextVariants, buttonVariants };
