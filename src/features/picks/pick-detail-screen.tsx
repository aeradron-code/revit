import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ChevronRight, Edit3, MapPin, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Platform, Pressable, View } from "react-native";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import {
  useDeletePersonalPick,
  usePersonalPick,
  useFollowedPicks,
  useTogglePickFollow,
} from "@/queries/picks";
import { useFollowStatus } from "@/queries/follows";

export function PickDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthUser();
  const pick = usePersonalPick(id);
  const deletePick = useDeletePersonalPick(id, user?.id ?? "");
  const followedPicks = useFollowedPicks(user?.id ?? "");
  const toggleFollow = useTogglePickFollow(user?.id ?? "", id);
  const authorFollow = useFollowStatus(
    user?.id ?? "",
    pick.data?.author_id ?? "",
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.picks);
  };

  if (pick.isLoading) return <PickLoadingState onBack={goBack} />;
  const personalPick = pick.data;
  if (pick.isError || !personalPick)
    return (
      <PickMissingState description={pick.error?.message} onBack={goBack} />
    );

  const isOwner = personalPick.author_id === user?.id;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader showAccountActions title="Picks" onBack={goBack} />
          ),
        }}
      />
      <FlatList
        data={personalPick.items}
        keyExtractor={(item) => item.entity_id}
        contentContainerClassName="grow px-4 py-6 md:mx-auto md:max-w-4xl md:px-6 md:py-12"
        ItemSeparatorComponent={PickItemSeparator}
        ListHeaderComponent={
          <View className="gap-6 pb-6">
            <View className="gap-4">
              <View className="flex-row items-center gap-3">
                <View className="h-0.5 w-7 rounded-full bg-primary" />
                <Text className="text-xs font-semibold tracking-widest text-primary">
                  PERSONAL PICK
                </Text>
              </View>
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 gap-2">
                  <Text
                    accessibilityRole="header"
                    className="text-3xl leading-tight text-foreground md:text-5xl"
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
                    }}
                  >
                    {personalPick.title}
                  </Text>
                  {personalPick.description ? (
                    <Text variant="muted" className="text-base leading-6">
                      {personalPick.description}
                    </Text>
                  ) : null}
                </View>
                {!isOwner && authorFollow.data ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      followedPicks.isLoading ||
                      followedPicks.isError ||
                      toggleFollow.isPending
                    }
                    onPress={() =>
                      toggleFollow.mutate(
                        !(followedPicks.data ?? []).includes(id),
                      )
                    }
                  >
                    <Text>
                      {toggleFollow.isPending
                        ? "Updating…"
                        : (followedPicks.data ?? []).includes(id)
                          ? "Following"
                          : "Follow"}
                    </Text>
                  </Button>
                ) : null}
                {isOwner ? (
                  <View className="flex-row gap-2">
                    <Button
                      accessibilityLabel="Edit Pick"
                      size="icon"
                      variant="outline"
                      hitSlop={8}
                      onPress={() =>
                        router.push(routes.editPick(personalPick.id))
                      }
                    >
                      <Icon as={Edit3} className="size-4" />
                    </Button>
                    <Button
                      accessibilityLabel="Delete Pick"
                      size="icon"
                      variant="destructive"
                      onPress={() => setIsDeleteOpen(true)}
                      hitSlop={8}
                    >
                      <Icon as={Trash2} className="size-4" />
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>

            {toggleFollow.isError || followedPicks.isError ? (
              <Text variant="muted">
                Couldn’t update or load followed Picks. Please try again.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Link href={routes.entity(item.entity.id)} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open ${item.entity.name}`}
              className="rounded-xl active:opacity-80"
            >
              <Card className="flex-row items-center gap-3 rounded-xl border-border bg-card p-3 shadow-none sm:gap-5 sm:p-5">
                <View className="items-center justify-center border-r border-border pr-3 sm:pr-5">
                  <Text
                    className="text-3xl text-primary sm:text-5xl"
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
                    }}
                  >
                    {String(item.position).padStart(2, "0")}
                  </Text>
                </View>
                <View className="size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary sm:size-20">
                  {item.entity.image_url ? (
                    <Image
                      source={{ uri: item.entity.image_url }}
                      contentFit="cover"
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <Icon
                      as={MapPin}
                      className="size-6 text-muted-foreground"
                    />
                  )}
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-base font-semibold sm:text-lg">
                    {item.entity.name}
                  </Text>
                  <Text variant="muted" className="text-sm">
                    {[item.entity.category.label, item.entity.locality]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {item.note ? (
                    <View className="mt-1 flex-row items-start gap-2">
                      <Text className="text-lg font-semibold leading-5 text-primary">
                        “
                      </Text>
                      <Text className="min-w-0 flex-1 text-sm leading-5">
                        {item.note}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Icon
                  as={ChevronRight}
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </Card>
            </Pressable>
          </Link>
        )}
      />
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this Pick?</DialogTitle>
            <DialogDescription>
              This permanently deletes the list. The finds themselves are not
              affected.
            </DialogDescription>
          </DialogHeader>
          {deletePick.isError ? (
            <Text variant="small" className="text-destructive">
              {deletePick.error.message}
            </Text>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onPress={() => setIsDeleteOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button
              disabled={deletePick.isPending}
              variant="destructive"
              onPress={() =>
                void deletePick
                  .mutateAsync()
                  .then(() => router.replace(routes.picks))
                  .catch(() => {})
              }
            >
              <Text>{deletePick.isPending ? "Deleting…" : "Delete Pick"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SafeAreaView>
  );
}

function PickLoadingState({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader showAccountActions title="Picks" onBack={onBack} />
          ),
        }}
      />
      <View className="px-6 py-6 md:mx-auto md:w-full md:max-w-2xl">
        <ContentSkeleton rows={3} />
      </View>
    </SafeAreaView>
  );
}

function PickMissingState({
  description,
  onBack,
}: {
  description?: string;
  onBack: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader showAccountActions title="Picks" onBack={onBack} />
          ),
        }}
      />
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text variant="h2">Pick unavailable</Text>
        <Text variant="muted" className="text-center">
          {description ?? "This Pick may have been deleted."}
        </Text>
        <Button variant="outline" onPress={onBack}>
          <Text>Go back</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function PickItemSeparator() {
  return <View className="h-3" />;
}
