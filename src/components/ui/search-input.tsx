import { Search } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = React.ComponentProps<typeof Input>;

function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <View
      className="min-h-11 flex-row items-center gap-2 rounded-lg border border-input bg-card px-3"
    >
      <Icon as={Search} className="size-4 shrink-0 text-muted-foreground" />
      <Input
        {...props}
        accessibilityRole="search"
        appearance="embedded"
        className={cn("flex-1", className)}
        returnKeyType={props.returnKeyType ?? "search"}
      />
    </View>
  );
}

export { SearchInput };
