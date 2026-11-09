import { Link } from "expo-router";
import { Image } from "expo-image";
import { Bookmark } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import type { PickDirectoryItem } from "@/api/picks";
import type { Profile } from "@/api/profiles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/routes";
import { useAuth } from "@/providers/auth-provider";
import {
  usePersonalPicksByAuthor,
  usePicksFromFollowing,
} from "@/queries/picks";

type Filter = "your" | "followed" | "all";

export function PicksScreen() {
  const { profile, user } = useAuth();
  const [filter, setFilter] = useState<Filter>("your");
  const [search, setSearch] = useState("");
  const own = usePersonalPicksByAuthor(user?.id ?? "");
  const directory = usePicksFromFollowing(user?.id ?? "");
  const loading = filter === "your" ? own.isLoading : directory.isLoading;
  const error = filter === "your" ? own.isError : directory.isError;
  const items = useMemo(() => {
    const source =
      filter === "your"
        ? (own.data ?? []).map((pick) => ({ ...pick, author: profile }))
        : (directory.data ?? []).filter(
            (pick) => filter === "all" || pick.isFollowed,
          );
    const query = search.trim().toLocaleLowerCase();
    return source.filter(
      (pick) =>
        !query ||
        [
          pick.title,
          pick.description,
          pick.author?.display_name,
          pick.author?.username,
        ].some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [filter, own.data, directory.data, profile, search]);
  const retry = () => {
    if (filter === "your") void own.refetch();
    else void directory.refetch();
  };
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <FlatList
        className="flex-1"
        contentContainerClassName="w-full gap-2 px-2 py-3 md:mx-auto md:max-w-3xl md:py-6"
        data={!loading && !error ? items : []}
        keyExtractor={(pick) => pick.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="w-full gap-4 pb-3">
            <Text variant="muted" className="leading-5">
              Discover collections from people you follow.
            </Text>
            <SearchInput
              accessibilityLabel="Search Picks or people"
              placeholder="Search Picks or people…"
              value={search}
              onChangeText={setSearch}
            />
            <View className="flex-row flex-wrap gap-2">
              {(
                [
                  ["your", "Your"],
                  ["followed", "Followed"],
                  ["all", "All"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? "default" : "outline"}
                  onPress={() => setFilter(value)}
                >
                  <Text>{label}</Text>
                </Button>
              ))}
            </View>
            {loading ? <PickListSkeleton /> : null}
            {error ? (
              <FeedbackState
                title="Couldn’t load Picks."
                variant="error"
                actionLabel="Retry"
                onAction={retry}
              />
            ) : null}
            {!loading && !error && items.length === 0 ? (
              <FeedbackState
                title={
                  search.trim()
                    ? "No Picks match your search"
                    : filter === "your"
                      ? "No Picks yet"
                      : filter === "followed"
                        ? "No followed Picks yet"
                        : "No Picks from people you follow"
                }
                description={
                  filter === "your" && !search.trim()
                    ? "Create your first ordered list of finds."
                    : undefined
                }
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => <PickRow pick={item} />}
      />
    </SafeAreaView>
  );
}

type RowPick = Omit<PickDirectoryItem, "author"> & {
  author: PickDirectoryItem["author"] | Profile | null;
};
function PickRow({ pick }: { pick: RowPick }) {
  const images = pick.imagePreviews;
  const initials = (pick.author?.display_name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <Link href={routes.pick(pick.id)} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${pick.title}`}
        className="w-full active:opacity-90"
      >
        <Card className="w-full flex-row items-center gap-3 p-3 shadow-none">
          <View className="flex-row gap-1">
            {images.length ? (
              images.map((item) => (
                <Image
                  key={item.entity_id}
                  source={{ uri: item.image_url }}
                  contentFit="cover"
                  style={{ width: 48, height: 64, borderRadius: 6 }}
                />
              ))
            ) : (
              <View className="size-16 items-center justify-center rounded-md bg-secondary">
                <Icon as={Bookmark} className="size-5 text-muted-foreground" />
              </View>
            )}
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-semibold" numberOfLines={1}>
              {pick.title}
            </Text>
            <Text variant="muted" className="text-sm" numberOfLines={1}>
              {pick.description?.trim() || "A collection of finds"}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Avatar
                alt={`${pick.author?.display_name ?? "User"}'s avatar`}
                className="size-5"
              >
                {pick.author?.avatar_url ? (
                  <AvatarImage source={{ uri: pick.author.avatar_url }} />
                ) : null}
                <AvatarFallback>
                  <Text className="text-[9px]">{initials}</Text>
                </AvatarFallback>
              </Avatar>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                @{pick.author?.username ?? "user"}
              </Text>
            </View>
          </View>
          <Text variant="muted" className="text-xs" numberOfLines={1}>
            {formatUpdatedAt(pick.updated_at)}
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}

function PickListSkeleton() {
  return (
    <View accessibilityLabel="Loading Picks" className="gap-2">
      {["first", "second", "third"].map((key) => (
        <View
          key={key}
          className="w-full flex-row items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <Skeleton className="size-16 shrink-0 rounded-md" />
          <View className="min-w-0 flex-1 gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
            <View className="flex-row items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 w-1/3" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
function formatUpdatedAt(value: string) {
  const time = new Date(value).getTime();
  const days = Math.floor((Date.now() - time) / 86400000);
  if (!Number.isFinite(time) || days < 0) return "Updated recently";
  if (days === 0) return "Updated today";
  if (days < 7) return `Updated ${days}d ago`;
  if (days < 35) return `Updated ${Math.floor(days / 7)}w ago`;
  return `Updated ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(new Date(value))}`;
}
