import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { ChevronRight, MapPin, Trash2 } from "lucide-react-native";
import {
  Pressable,
  FlatList,
  RefreshControl,
  useWindowDimensions,
  View,
} from "react-native";
import type { SharePostWithDetails } from "@/api/shares";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ProfileMessageScreen } from "@/features/profile/profile-state-screen";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useDeleteEntity, useEntity } from "@/queries/entities";
import {
  useEntityRatingSummary,
  useSharePostsByEntity,
} from "@/queries/shares";
import { StarRating } from "@/features/ratings/star-rating";

export function EntityDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const entityId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const entity = useEntity(entityId);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.discover);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader showAccountActions title="Find" onBack={goBack} />
          ),
        }}
      />
      {entity.isLoading ? <EntityDetailLoading /> : null}
      {entity.isError ? (
        <ProfileMessageScreen
          title="Find unavailable"
          description="We couldn’t load this find. Check your connection and try again."
          action={() => void entity.refetch()}
        />
      ) : null}
      {!entity.isLoading && !entity.isError && !entity.data ? (
        <ProfileMessageScreen
          title="Find not found"
          description="This find may have been removed or is no longer available."
        />
      ) : null}
      {entity.data ? <EntityDetails entityId={entityId} /> : null}
    </SafeAreaView>
  );
}

function EntityDetails({ entityId }: { entityId: string }) {
  const { width } = useWindowDimensions();
  const horizontal = width >= 900;
  const entity = useEntity(entityId);
  const user = useAuthUser();
  const deleteEntity = useDeleteEntity(entityId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const summary = useEntityRatingSummary(entityId);
  const posts = useSharePostsByEntity(entityId);
  const sharePosts = useMemo(
    () => posts.data?.pages.flatMap((page) => page.items) ?? [],
    [posts.data],
  );
  const entityData = entity.data;

  if (!entityData) return null;

  return (
    <>
      <FlatList
        className="flex-1"
        contentContainerClassName="w-full gap-3 px-6 py-6 md:mx-auto md:max-w-5xl md:px-6 md:py-6"
        data={sharePosts}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={
          <View className="gap-6 pb-2">
            <View
              className="gap-4 rounded-lg border border-border bg-card p-4 md:p-6"
              style={{
                flexDirection: horizontal ? "row" : "column",
                alignItems: horizontal ? "center" : "stretch",
              }}
            >
              <FindImage
                key={entityData.image_url ?? entityData.id}
                url={entityData.image_url}
                name={entityData.name}
                horizontal={horizontal}
              />
              <View className="min-w-0 flex-1 gap-3">
                <View className="gap-1">
                  <View className="self-start rounded-full bg-muted px-3 py-1">
                    <Text variant="muted" className="text-sm font-medium">
                      {entityData.category.label}
                    </Text>
                  </View>
                  <Text variant="h1" className="text-left">
                    {entityData.name}
                  </Text>
                  {formatEntityLocation(entityData) ? (
                    <View className="flex-row items-center gap-1.5">
                      <Icon
                        as={MapPin}
                        className="size-4 text-muted-foreground"
                      />
                      <Text variant="muted" className="text-sm">
                        {formatEntityLocation(entityData)}
                      </Text>
                    </View>
                  ) : null}
                  {entityData.description ? (
                    <Text>{entityData.description}</Text>
                  ) : null}
                </View>
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <StarRating
                      value={summary.data?.averageScore ?? null}
                      readOnly
                      allowHalf
                      animated={false}
                      starSize={20}
                      gap={2}
                    />
                    <Text className="text-2xl font-semibold">
                      {summary.isLoading || summary.isError
                        ? "—"
                        : (summary.data?.averageScore?.toFixed(1) ?? "—")}
                    </Text>
                    <Text variant="muted" className="pb-0.5 text-sm">
                      {summary.isLoading || summary.isError
                        ? "ratings"
                        : `${summary.data?.ratingCount ?? 0} ${(summary.data?.ratingCount ?? 0) === 1 ? "rating" : "ratings"}`}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Button
                      onPress={() =>
                        router.push({
                          pathname: routes.createShare,
                          params: { entityId },
                        })
                      }
                    >
                      <Text>Rate this find</Text>
                    </Button>
                    {user?.id && entityData.created_by === user.id ? (
                      <Button
                        accessibilityLabel="Delete find"
                        disabled={deleteEntity.isPending}
                        size="icon"
                        variant="destructive"
                        className="size-11 p-0"
                        onPress={() => setIsDeleteOpen(true)}
                      >
                        <Icon as={Trash2} className="size-4 text-white" />
                      </Button>
                    ) : null}
                  </View>
                </View>
                {summary.isError ? (
                  <Text variant="small" className="text-destructive">
                    {summary.error.message}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="mx-auto w-full max-w-[36rem]">
            {posts.isLoading ? <EntityPostsLoading /> : null}
            {posts.isError ? (
              <FeedbackState
                actionLabel="Retry"
                onAction={() => void posts.refetch()}
                title="Couldn’t load ratings."
                variant="error"
              />
            ) : null}
            {!posts.isLoading && !posts.isError ? (
              <FeedbackState
                description="Be the first to share your experience."
                title="No ratings yet"
              />
            ) : null}
          </View>
        }
        ListFooterComponent={
          posts.hasNextPage ? (
            <Button
              disabled={posts.isFetchingNextPage}
              variant="outline"
              className="self-center"
              onPress={() => void posts.fetchNextPage()}
            >
              <Text>
                {posts.isFetchingNextPage ? "Loading…" : "Load more ratings"}
              </Text>
            </Button>
          ) : undefined
        }
        renderItem={({ item }) => <RatingRow post={item} />}
        refreshControl={
          <RefreshControl
            refreshing={
              entity.isRefetching || summary.isRefetching || posts.isRefetching
            }
            onRefresh={() =>
              void Promise.all([
                entity.refetch(),
                summary.refetch(),
                posts.refetch(),
              ])
            }
          />
        }
      />
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this find?</DialogTitle>
            <DialogDescription>
              This permanently deletes the find. Finds used in posts or Picks
              cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          {deleteEntity.isError ? (
            <Text className="text-destructive">
              {deleteEntity.error.message}
            </Text>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onPress={() => setIsDeleteOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button
              variant="destructive"
              disabled={deleteEntity.isPending}
              onPress={() =>
                void deleteEntity
                  .mutateAsync()
                  .then(() => router.replace(routes.discover))
                  .catch(() => {})
              }
            >
              <Text>
                {deleteEntity.isPending ? "Deleting…" : "Delete find"}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FindImage({
  url,
  name,
  horizontal,
}: {
  url: string | null;
  name: string;
  horizontal: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const placeholder = !url || failed;
  const dimensions = {
    width: horizontal ? 160 : ("100%" as const),
    height: horizontal ? 160 : 192,
  };
  if (placeholder) {
    return (
      <View
        accessibilityLabel={`${name} image placeholder`}
        className="items-center justify-center rounded-lg bg-selected"
        style={dimensions}
      >
        <Text className="text-5xl font-semibold text-primary">
          {name.trim().slice(0, 1).toUpperCase() || "F"}
        </Text>
      </View>
    );
  }
  return (
    <View style={dimensions} className="overflow-hidden rounded-lg">
      <Image
        source={{ uri: url }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        onError={() => setFailed(true)}
        accessibilityLabel={`${name} photo`}
      />
    </View>
  );
}

function RatingRow({ post }: { post: SharePostWithDetails }) {
  const initials = (post.author.display_name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const date = new Date(post.created_at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <Link href={routes.post(post.id)} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`View ${post.author.display_name}'s rating and post`}
        className="mx-auto w-full max-w-xl flex-row flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 active:opacity-70"
      >
        <Avatar
          alt={`${post.author.display_name}'s avatar`}
          className="size-10"
        >
          {post.author.avatar_url ? (
            <AvatarImage source={{ uri: post.author.avatar_url }} />
          ) : null}
          <AvatarFallback>
            <Text className="font-semibold">{initials}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {post.author.display_name}
          </Text>
          <Text variant="muted" className="text-xs" numberOfLines={1}>
            @{post.author.username} · {date}
          </Text>
        </View>
        <StarRating
          value={post.ratingScore}
          readOnly
          animated={false}
          starSize={18}
          gap={2}
          accessibilityLabel={`${post.ratingScore} out of 5 stars`}
        />
        <View className="flex-row items-center gap-1">
          <Text className="text-sm font-semibold text-primary">View post</Text>
          <Icon as={ChevronRight} className="size-4 text-primary" />
        </View>
      </Pressable>
    </Link>
  );
}

function EntityDetailLoading() {
  return (
    <View className="w-full gap-6 px-6 md:mx-auto md:max-w-3xl md:py-6">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-60 w-full" />
    </View>
  );
}

function EntityPostsLoading() {
  return (
    <View className="gap-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </View>
  );
}

function formatEntityLocation(entity: {
  address_line_1: string | null;
  address_line_2: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  locality: string | null;
  district: string | null;
}) {
  return [
    entity.address_line_1,
    entity.address_line_2,
    entity.locality,
    entity.district,
    entity.state,
    entity.postal_code,
    entity.country,
  ]
    .filter(Boolean)
    .join(", ");
}
