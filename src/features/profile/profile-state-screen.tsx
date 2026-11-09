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
      <View className="w-full gap-1 md:mx-auto md:max-w-4xl md:px-6 md:py-6">
        <View className="overflow-hidden border border-border bg-card md:rounded-xl">
          <Skeleton className="h-28 w-full rounded-none sm:h-36" />
          <View className="px-5 pb-3 sm:flex-row sm:items-start sm:gap-5 sm:px-8 sm:pb-7">
            <Skeleton className="-mt-10 size-24 rounded-full border-2 border-background sm:-mt-8 sm:size-28" />
            <View className="min-w-0 flex-1 gap-3 pt-3 sm:pt-5">
              <View className="gap-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </View>
              <View className="gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </View>
              <View className="flex-row gap-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </View>
              <Skeleton className="h-10 w-28 rounded-md" />
            </View>
          </View>
        </View>
        <Skeleton className="h-1 w-full md:hidden" />
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
