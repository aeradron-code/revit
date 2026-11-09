import { Link } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { FlatList, View } from "react-native";

import type { DiscoveryPost, DiscoveryProfile } from "@/api/discover";
import type { Entity } from "@/api/entities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { getInitials } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useDiscover } from "@/queries/discover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type ResultFilter = "people" | "posts" | "entities";
type DiscoverRow =
  | { type: "profile"; item: DiscoveryProfile }
  | { type: "post"; item: DiscoveryPost }
  | { type: "entity"; item: Entity };

export function DiscoverScreen() {
  const user = useAuthUser();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResultFilter>("people");
  const debouncedQuery = useDebouncedValue(query);
  const isDebouncing = query.trim() !== debouncedQuery.trim();
  const results = useDiscover(debouncedQuery, user?.id ?? "");
  const hasSearchTerm = query.trim().length >= 2;
  const profiles = results.data?.profiles ?? [];
  const posts = results.data?.posts ?? [];
  const entities = results.data?.entities ?? [];
  const selectedItems: DiscoverRow[] =
    filter === "people"
      ? profiles.map((item) => ({ type: "profile" as const, item }))
      : filter === "posts"
        ? posts.map((item) => ({ type: "post" as const, item }))
        : entities.map((item) => ({ type: "entity" as const, item }));
  const data =
    hasSearchTerm && !isDebouncing && !results.isLoading && !results.isError
      ? selectedItems
      : [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <FlatList<DiscoverRow>
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-3xl gap-3 px-2 py-3 md:py-6"
        data={data}
        keyExtractor={(row) =>
          `${row.type}:${row.type === "profile" ? row.item.username : row.item.id}`
        }
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            <SearchInput
              accessibilityLabel="Search Revit"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Search people, posts, or finds"
              value={query}
              onChangeText={setQuery}
            />
            {hasSearchTerm ? (
              <View className="flex-row flex-wrap gap-2">
                {(["people", "posts", "entities"] as const).map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={filter === item ? "default" : "outline"}
                    onPress={() => setFilter(item)}
                  >
                    <Text>
                      {item === "entities"
                        ? "Finds"
                        : item.charAt(0).toUpperCase() + item.slice(1)}
                    </Text>
                  </Button>
                ))}
              </View>
            ) : null}
            {!hasSearchTerm ? (
              <SearchState
                description="Enter at least two characters to search across the available community content."
                title="What are you looking for?"
              />
            ) : null}
            {hasSearchTerm && (isDebouncing || results.isLoading) ? (
              <DiscoverResultsSkeleton filter={filter} />
            ) : null}
            {hasSearchTerm && !isDebouncing && results.isError ? (
              <FeedbackState
                actionLabel="Retry"
                onAction={() => void results.refetch()}
                title="Couldn’t load search results."
                variant="error"
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          hasSearchTerm &&
          !isDebouncing &&
          !results.isLoading &&
          !results.isError ? (
            <SearchState
              description="Try another search or choose a different result type."
              title={`No ${filter === "entities" ? "finds" : filter} found`}
            />
          ) : undefined
        }
        renderItem={({ item }) =>
          item.type === "profile" ? (
            <ProfileResult profile={item.item} />
          ) : item.type === "post" ? (
            <PostResult post={item.item} />
          ) : (
            <EntityResult entity={item.item} />
          )
        }
      />
    </SafeAreaView>
  );
}

function ProfileResult({ profile }: { profile: DiscoveryProfile }) {
  return (
    <Link href={routes.user(profile.username)} asChild>
      <Button
        className="gap-3 border border-border bg-card"
        size="content"
        variant="ghost"
      >
        <Avatar alt={`${profile.displayName}'s avatar`} className="size-9">
          {profile.avatarUrl ? (
            <AvatarImage source={{ uri: profile.avatarUrl }} />
          ) : null}
          <AvatarFallback>
            <Text variant="small">{getInitials(profile.displayName)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="min-w-0 flex-1 items-start gap-0.5">
          <Text className="truncate text-left font-semibold">
            {profile.displayName}
          </Text>
          <Text variant="muted" className="truncate text-left text-xs">
            @{profile.username}
          </Text>
        </View>
      </Button>
    </Link>
  );
}

function PostResult({ post }: { post: DiscoveryPost }) {
  return (
    <Link href={routes.post(post.id)} asChild>
      <Button
        className="items-start gap-3 border border-border bg-card"
        size="content"
        variant="ghost"
      >
        <Avatar alt={`${post.authorName}'s avatar`} className="size-9">
          <AvatarFallback>
            <Text variant="small">{getInitials(post.authorName)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="min-w-0 flex-1 items-start gap-1">
          <View className="w-full flex-row items-center gap-2">
            <Text
              className="min-w-0 flex-1 truncate text-left font-semibold"
              numberOfLines={1}
            >
              {post.authorName}
            </Text>
            <Badge className="rounded-full px-2 py-0.5" variant="secondary">
              <Text className="text-[10px] font-semibold">{post.postType}</Text>
            </Badge>
          </View>
          <Text className="text-left text-sm leading-5" numberOfLines={2}>
            {post.body ?? "Rating"}
          </Text>
        </View>
      </Button>
    </Link>
  );
}

function EntityResult({ entity }: { entity: Entity }) {
  return (
    <Link href={routes.entity(entity.id)} asChild>
      <Button
        className="gap-3 border border-border bg-card"
        size="content"
        variant="ghost"
      >
        <View className="size-9 items-center justify-center rounded-md bg-accent">
          <Icon as={MapPin} className="size-5 text-accent-foreground" />
        </View>
        <View className="min-w-0 flex-1 items-start gap-0.5">
          <Text className="truncate text-left font-semibold">
            {entity.name}
          </Text>
          <Text variant="muted" className="truncate text-left text-xs">
            {[entity.category.label, entity.locality]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </Button>
    </Link>
  );
}

function DiscoverResultsSkeleton({ filter }: { filter: ResultFilter }) {
  return (
    <View accessibilityLabel="Loading search results" className="gap-2">
      {["first", "second"].map((key) => (
        <View
          key={key}
          className="min-h-14 w-full flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
        >
          <Skeleton
            className={`size-9 ${filter === "entities" ? "rounded-md" : "rounded-full"}`}
          />
          <View className="min-w-0 flex-1 gap-1">
            <View className="w-full flex-row items-center justify-between gap-2">
              <Skeleton className="h-4 w-2/5" />
              {filter === "posts" ? (
                <Skeleton className="h-5 w-14 rounded-full" />
              ) : null}
            </View>
            <Skeleton className="h-3 w-3/5" />
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return <FeedbackState description={description} title={title} />;
}
