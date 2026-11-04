import { Sparkles } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";

type RoutePlaceholderScreenProps = { description: string; title: string };

export function RoutePlaceholderScreen({
  description,
  title,
}: RoutePlaceholderScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="mx-auto w-full max-w-5xl flex-1 gap-5 px-3 py-5 sm:px-6 sm:py-7">
        <View className="gap-2">
          <Text variant="h1" className="text-left">
            {title}
          </Text>
          <View className="h-1 w-10 rounded-sm bg-primary" />
        </View>
        <View className="max-w-2xl rounded-lg border border-border bg-secondary p-4">
          <View className="gap-3">
            <View className="size-10 items-center justify-center rounded-md bg-card">
              <Icon as={Sparkles} className="text-primary" />
            </View>
            <Text className="max-w-xl text-base leading-6 text-secondary-foreground">
              {description}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
