import { Link } from "expo-router";
import { Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import type { ForumSummary } from "@/api/forums";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { PageScrollView } from "@/components/ui/page-scroll-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
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
      <PageScrollView contentWidth="standard" contentContainerClassName="gap-5">
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

          {forums.isLoading ? <ContentSkeleton /> : null}
          {forums.isError ? (
            <FeedbackState
              actionLabel="Retry"
              onAction={() => void forums.refetch()}
              title="Couldn’t load forums."
              variant="error"
            />
          ) : null}
          {!forums.isLoading && !forums.isError && allForums.length === 0 ? (
            <FeedbackState
              description={
                filter === "popular"
                  ? undefined
                  : "Start a community around something you care about."
              }
              title={
                filter === "popular"
                  ? search.trim()
                    ? "No forums match your search"
                    : "Search forums to explore"
                  : "No forums yet"
              }
            />
          ) : null}
          {!forums.isLoading &&
          !forums.isError &&
          allForums.length > 0 &&
          visibleForums.length === 0 ? (
            <FeedbackState
              title={
                filter === "popular" && search.trim().length === 0
                  ? "Search forums to explore"
                  : filter === "your" && search.trim().length === 0
                    ? "You haven’t created any forums yet"
                    : filter === "joined" && search.trim().length === 0
                      ? "You haven’t joined any forums yet"
                      : "No forums match your search"
              }
            />
          ) : null}
          {visibleForums.length > 0 ? (
            <View className="gap-2">
              {visibleForums.map((forum) => (
                <ForumListItem key={forum.id} forum={forum} />
              ))}
            </View>
          ) : null}
        </View>
      </PageScrollView>
    </SafeAreaView>
  );
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

function formatMemberCount(count: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(
    count,
  );
}
