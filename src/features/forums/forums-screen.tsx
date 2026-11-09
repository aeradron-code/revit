import { Link } from "expo-router";
import { Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import type { ForumSummary } from "@/api/forums";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { ForumAvatar } from "@/features/forums/forum-avatar";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useForums } from "@/queries/forums";

type ForumFilter = "joined" | "your" | "popular";

export function ForumsScreen() {
  const user = useAuthUser();
  const forums = useForums(user?.id ?? "");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ForumFilter>("your");
  const allForums = forums.data ?? [];
  const visibleForums = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (filter === "popular" && !query) return [];

    const filtered = allForums.filter((forum) => {
      if (
        filter === "joined" &&
        (!forum.isMember || forum.owner_id === user?.id)
      ) {
        return false;
      }
      if (filter === "your" && forum.owner_id !== user?.id) return false;
      if (!query) return true;
      return [forum.name, forum.description, forum.slug]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(query));
    });

    return filtered;
  }, [allForums, filter, search, user?.id]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <FlatList
        className="flex-1"
        contentContainerClassName="mx-auto w-full gap-5 px-2 py-3 md:max-w-3xl md:py-6"
        data={!forums.isLoading && !forums.isError ? visibleForums : []}
        keyExtractor={(forum) => forum.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="w-full gap-4">
            <Text variant="muted" className="leading-5">
              Explore forums, share common experiences, and get real insights.
            </Text>

            <SearchInput
              accessibilityLabel="Search forums"
              placeholder="Search forums…"
              value={search}
              onChangeText={setSearch}
            />

            <View className="flex-row flex-wrap gap-2">
              {(
                [
                  ["your", "Your"],
                  ["joined", "Joined"],
                  ["popular", "Popular"],
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

            {forums.isLoading ? <ForumListSkeleton /> : null}
            {forums.isError ? (
              <FeedbackState
                actionLabel="Retry"
                onAction={() => void forums.refetch()}
                title="Couldn’t load forums."
                variant="error"
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !forums.isLoading && !forums.isError ? (
            <FeedbackState
              description={
                allForums.length === 0 && filter !== "popular"
                  ? "Start a community around something you care about."
                  : undefined
              }
              title={getEmptyMessage({
                allForums,
                filter,
                search,
              })}
            />
          ) : undefined
        }
        renderItem={({ item }) => <ForumListItem forum={item} />}
      />
    </SafeAreaView>
  );
}

function getEmptyMessage({
  allForums,
  filter,
  search,
}: {
  allForums: ForumSummary[];
  filter: ForumFilter;
  search: string;
}) {
  if (allForums.length === 0) {
    return filter === "popular"
      ? search.trim()
        ? "No forums match your search"
        : "Search forums to explore"
      : "No forums yet";
  }
  if (filter === "popular" && !search.trim()) return "Search forums to explore";
  if (filter === "your" && !search.trim())
    return "You haven’t created any forums yet";
  if (filter === "joined" && !search.trim())
    return "You haven’t joined any forums yet";
  return "No forums match your search";
}

function ForumListItem({ forum }: { forum: ForumSummary }) {
  return (
    <Card className="w-full flex-row items-center gap-3 border-border bg-card p-3 shadow-none">
      <Link href={routes.forum(forum.id)} asChild>
        <Pressable
          accessibilityLabel={`Open ${forum.name} forum`}
          accessibilityRole="link"
          className="min-w-0 flex-1 flex-row items-center gap-3"
        >
          <ForumAvatar name={forum.name} imageUrl={forum.imageUrl} />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-semibold" numberOfLines={1}>
              {forum.name}
            </Text>
            <Text
              className="text-xs leading-5"
              numberOfLines={2}
              variant="muted"
            >
              {forum.description?.trim() || "A public discussion forum."}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Icon as={Users} className="size-3.5 text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">
                {formatMemberCount(forum.memberCount)} members
              </Text>
            </View>
          </View>
        </Pressable>
      </Link>
    </Card>
  );
}

function ForumListSkeleton() {
  return (
    <View accessibilityLabel="Loading forums" className="gap-2">
      {["first", "second", "third"].map((key) => (
        <View
          key={key}
          className="w-full flex-row items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <Skeleton className="size-10 rounded-lg" />
          <View className="min-w-0 flex-1 gap-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </View>
        </View>
      ))}
    </View>
  );
}

function formatMemberCount(count: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(
    count,
  );
}
