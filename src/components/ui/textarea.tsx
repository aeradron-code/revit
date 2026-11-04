import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TextareaProps = Omit<React.ComponentProps<typeof Input>, "multiline">;

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <Input
      className={cn("min-h-24 items-start py-3", className)}
      multiline
      textAlignVertical="top"
      {...props}
    />
  );
}

export { Textarea };
