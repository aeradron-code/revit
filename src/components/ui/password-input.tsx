import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "secureTextEntry"
>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View className="relative">
      <Input
        {...props}
        className={`pr-12 ${className ?? ""}`}
        secureTextEntry={!isVisible}
      />
      <Button
        accessibilityLabel={isVisible ? "Hide password" : "Show password"}
        className="absolute right-0 top-0"
        size="icon"
        variant="ghost"
        onPress={() => setIsVisible((current) => !current)}
      >
        <Icon
          as={isVisible ? EyeOff : Eye}
          className="size-5 text-muted-foreground"
        />
      </Button>
    </View>
  );
}
