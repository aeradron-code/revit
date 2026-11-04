import { Sparkles } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

export function ProfileLoadingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="w-full gap-6 px-6 md:mx-auto md:max-w-4xl md:py-6">
        <View className="flex-row items-center gap-3">
          <Skeleton className="size-24 rounded-full" />
          <View className="flex-1 gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-32" />
          </View>
        </View>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-36 w-full" />
      </View>
    </SafeAreaView>
  );
}

export function ProfileMessageScreen({
  action,
  description,
  title,
}: {
  action?: () => void;
  description: string;
  title: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-lg items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-none">
          <View className="size-10 items-center justify-center rounded-md bg-secondary">
            <Icon as={Sparkles} className="text-primary" />
          </View>
          <Text variant="h2" className="text-center">
            {title}
          </Text>
          <Text variant="muted" className="max-w-md text-center leading-5">
            {description}
          </Text>
          {action ? (
            <Button variant="outline" className="mt-2" onPress={action}>
              <Text>Try again</Text>
            </Button>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
