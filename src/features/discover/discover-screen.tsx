import { Link } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import type {
  DiscoverResults,
  DiscoveryPost,
  DiscoveryProfile,
} from "@/api/discover";
import type { Entity } from "@/api/entities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { PageScrollView } from "@/components/ui/page-scroll-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { SearchInput } from "@/components/ui/search-input";
import { Text } from "@/components/ui/text";
import { getInitials } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useDiscover } from "@/queries/discover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type ResultFilter = "people" | "posts" | "entities";

export function DiscoverScreen() {
  const user = useAuthUser();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResultFilter>("people");
  const debouncedQuery = useDebouncedValue(query);
  const isDebouncing = query.trim() !== debouncedQuery.trim();
  const results = useDiscover(debouncedQuery, user?.id ?? "");
  const hasSearchTerm = query.trim().length >= 2;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <PageScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-6"
      >
        <SearchInput
          accessibilityLabel="Search Revit"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search people, posts, or finds"
          value={query}
          onChangeText={setQuery}
        />

        {!hasSearchTerm ? (
          <SearchState
            description="Enter at least two characters to search across the available community content."
            title="What are you looking for?"
          />
        ) : null}

        {hasSearchTerm && (isDebouncing || results.isLoading) ? (
          <ContentSkeleton rows={2} />
        ) : null}

        {hasSearchTerm && !isDebouncing && results.isError ? (
          <FeedbackState
            actionLabel="Retry"
            onAction={() => void results.refetch()}
            title="Couldn’t load search results."
            variant="error"
          />
        ) : null}

        {hasSearchTerm &&
        !isDebouncing &&
        !results.isLoading &&
        !results.isError ? (
          <DiscoverResultsView
            filter={filter}
            onFilterChange={setFilter}
            results={results.data}
          />
        ) : null}
      </PageScrollView>
    </SafeAreaView>
  );
}

function DiscoverResultsView({
  filter,
  onFilterChange,
  results,
}: {
  filter: ResultFilter;
  onFilterChange: (filter: ResultFilter) => void;
  results: DiscoverResults | undefined;
}) {
  const profiles = results?.profiles ?? [];
  const posts = results?.posts ?? [];
  const entities = results?.entities ?? [];

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap gap-2">
        {(["people", "posts", "entities"] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? "default" : "outline"}
            onPress={() => onFilterChange(item)}
          >
            <Text>
              {item === "entities"
                ? "Finds"
                : item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </Button>
        ))}
      </View>
      {filter === "people" && profiles.length > 0 ? (
        <ProfileResults profiles={profiles} />
      ) : null}
      {filter === "posts" && posts.length > 0 ? (
        <PostResults posts={posts} />
      ) : null}
      {filter === "entities" && entities.length > 0 ? (
        <EntityResults entities={entities} />
      ) : null}
      {(filter === "people" && profiles.length === 0) ||
      (filter === "posts" && posts.length === 0) ||
      (filter === "entities" && entities.length === 0) ? (
        <SearchState
          description="Try another search or choose a different result type."
          title={`No ${filter === "entities" ? "finds" : filter} found`}
        />
      ) : null}
    </View>
  );
}

function ProfileResults({ profiles }: { profiles: DiscoveryProfile[] }) {
  return (
    <ResultSection>
      {profiles.map((profile) => (
        <Link
          key={profile.username}
          href={routes.user(profile.username)}
          asChild
        >
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
      ))}
    </ResultSection>
  );
}

function PostResults({ posts }: { posts: DiscoveryPost[] }) {
  return (
    <ResultSection>
      {posts.map((post) => (
        <Link key={post.id} href={routes.post(post.id)} asChild>
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
                  <Text className="text-[10px] font-semibold">
                    {post.postType}
                  </Text>
                </Badge>
              </View>
              <Text className="text-left text-sm leading-5" numberOfLines={2}>
                {post.body ?? "Rating"}
              </Text>
            </View>
          </Button>
        </Link>
      ))}
    </ResultSection>
  );
}

function EntityResults({ entities }: { entities: Entity[] }) {
  return (
    <ResultSection>
      {entities.map((entity) => (
        <Link key={entity.id} href={routes.entity(entity.id)} asChild>
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
      ))}
    </ResultSection>
  );
}

function ResultSection({ children }: { children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <View className="gap-2">{children}</View>
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
