import { cva, type VariantProps } from "class-variance-authority";
import { Platform, TextInput } from "react-native";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "text-foreground flex w-full min-w-0 flex-row items-center text-[15px] leading-5",
  {
    variants: {
      appearance: {
        default:
          "border-input bg-card rounded-lg border px-3",
        embedded:
          "border-0 bg-transparent px-0 focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0",
      },
      size: {
        default: "min-h-12 py-2.5",
        compact: "min-h-11 py-2 text-sm",
      },
    },
    defaultVariants: { appearance: "default", size: "default" },
  },
);

type InputProps = Omit<React.ComponentProps<typeof TextInput>, "size"> &
  React.RefAttributes<TextInput> &
  VariantProps<typeof inputVariants> & {
    placeholderTextColorClassName?: string;
  };

function Input({
  appearance,
  className,
  placeholderTextColorClassName,
  size,
  ...props
}: InputProps) {
  return (
    <TextInput
      className={cn(
        inputVariants({ appearance, size }),
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({
              web: "disabled:pointer-events-none disabled:cursor-not-allowed",
            }),
          ),
        Platform.select({
          web: cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm",
            "focus:border-input focus-visible:border-input focus-visible:ring-0",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          ),
        }),
        className,
      )}
      placeholderTextColorClassName={
        placeholderTextColorClassName ?? "accent-muted-foreground"
      }
      underlineColorAndroid="transparent"
      {...props}
    />
  );
}

export { Input, inputVariants };
