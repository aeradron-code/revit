import { Link } from "expo-router";
import { UserCheck, UserPlus } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useMemo, useState } from "react";
import type { Profile } from "@/api/profiles";
import type { HomeFeedPost } from "@/api/feed";
import type { PickDirectoryItem } from "@/api/picks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { pageContainerClassName } from "@/components/ui/page-layout";
import { PageListContainer } from "@/components/ui/page-list-container";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { AskPostCard } from "@/features/posts/ask-post-card";
import { SharePostCard } from "@/features/posts/share-post-card";
import { PickRow } from "@/features/picks/picks-screen";
import { getInitials } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useFollowStatus, useFollowToggle } from "@/queries/follows";
import { useProfilePostsByAuthor } from "@/queries/feed";
import { usePersonalPicksByAuthor } from "@/queries/picks";

import { AppList } from "@/components/ui/app-list";
import { useFollowCounts } from "@/queries/profiles";
import { SafetyOptionsMenu } from "@/features/safety/safety-options-menu";
import { useMyBlockStatus } from "@/queries/safety";

type ProfileListItem =
  | { type: "post"; item: HomeFeedPost }
  | { type: "pick"; item: PickDirectoryItem };
type ProfileTab = "posts" | "picks";

type ProfileViewProps = {
  isOwnProfile?: boolean;
  profile: Profile;
};

export function ProfileView({
  isOwnProfile = false,
  profile,
}: ProfileViewProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1300;
  const user = useAuthUser();
  const isOwn = isOwnProfile || user?.id === profile.id;
  const counts = useFollowCounts(profile.id);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const posts = useProfilePostsByAuthor(profile.id);
  const picks = usePersonalPicksByAuthor(isOwn ? profile.id : "");
  const postItems = useMemo(
    () => posts.data?.pages.flatMap((page) => page.items) ?? [],
    [posts.data],
  );
  const listItems: ProfileListItem[] =
    tab === "posts"
      ? postItems.map((item) => ({ type: "post", item }))
      : (picks.data ?? []).map((item) => ({ type: "pick", item }));
  const listContentWidth = "feed";
  const followStatus = useFollowStatus(user?.id ?? "", profile.id);
  const followToggle = useFollowToggle(user?.id ?? "", profile.id);
  const blockStatus = useMyBlockStatus(user?.id ?? "", profile.id);
  const initials = getInitials(profile.display_name);

  const refresh = async () => {
    await Promise.all([
      counts.refetch(),
      posts.refetch(),
      ...(isOwn ? [picks.refetch()] : []),
      ...(isOwn ? [] : [followStatus.refetch(), blockStatus.refetch()]),
    ]);
  };

  const profileDetails = (
    <View className="gap-1">
      <View className="overflow-hidden md:rounded-xl border border-border bg-card">
        <View
          className={
            isWide ? "h-16 overflow-hidden" : "h-28 overflow-hidden sm:h-36"
          }
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 900 144"
          >
            <Defs>
              <LinearGradient id="profileCover" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor="#101b33" />
                <Stop offset="1" stopColor="#2453ae" />
              </LinearGradient>
            </Defs>
            <Rect width="900" height="144" fill="url(#profileCover)" />
            <Circle cx="125" cy="180" r="105" fill="#142b58" stroke="#2859ac" />
            <Circle cx="760" cy="310" r="245" fill="#16356c" stroke="#2c62bd" />
          </Svg>
        </View>
        <View
          className={
            isWide
              ? "px-4 pb-4"
              : "px-5 pb-3 sm:flex-row sm:items-start sm:gap-5 sm:px-8 sm:pb-7"
          }
        >
          <Avatar
            alt={`${profile.display_name}'s avatar`}
            className={
              isWide
                ? "-mt-8 size-16 border-2 border-blue-500 shadow-none"
                : "-mt-10 size-24 border-2 border-blue-500 shadow-none sm:-mt-8 sm:size-28"
            }
          >
            {profile.avatar_url ? (
              <AvatarImage
                accessibilityLabel={`${profile.display_name}'s avatar`}
                source={{ uri: profile.avatar_url }}
              />
            ) : null}
            <AvatarFallback>
              <Text className="text-3xl font-semibold">{initials}</Text>
            </AvatarFallback>
          </Avatar>
          <View
            className={
              isWide
                ? "min-w-0 gap-3 pt-3"
                : "min-w-0 flex-1 gap-3 pt-3 sm:pt-5"
            }
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="h1" className="text-left" numberOfLines={1}>
                  {profile.display_name}
                </Text>
                <Text variant="muted" className="text-sm">
                  @{profile.username}
                </Text>
              </View>
              {!isOwn ? (
                <View className="shrink-0 flex-row items-center gap-2">
                  {!blockStatus.data ? (
                    <Button
                      accessibilityLabel={
                        followStatus.data ? "Unfollow user" : "Follow user"
                      }
                      className="min-h-10 rounded-full px-4"
                      disabled={
                        followStatus.isLoading ||
                        followToggle.isPending ||
                        blockStatus.isLoading ||
                        blockStatus.isError
                      }
                      variant={followStatus.data ? "outline" : "default"}
                      onPress={() =>
                        followToggle.mutate(!(followStatus.data ?? false))
                      }
                      size="sm"
                    >
                      {!followToggle.isPending ? (
                        <Icon
                          as={followStatus.data ? UserCheck : UserPlus}
                          className={
                            followStatus.data
                              ? "size-4 text-primary dark:text-foreground"
                              : "size-4 text-primary-foreground"
                          }
                        />
                      ) : null}
                      <Text>
                        {followToggle.isPending
                          ? "Updating…"
                          : followStatus.data
                            ? "Following"
                            : "Follow"}
                      </Text>
                    </Button>
                  ) : null}
                  <SafetyOptionsMenu
                    ownerId={profile.id}
                    targetId={profile.id}
                    targetLabel="person"
                    blockMenuLabel="Block"
                    unblockMenuLabel="Unblock"
                    targetType="user"
                    triggerClassName="size-10 border border-border bg-card p-2.5"
                  />
                </View>
              ) : null}
            </View>
            <Text className="leading-6 text-foreground">
              {profile.bio?.trim() ||
                (isOwnProfile
                  ? "Add a bio to tell people what you like."
                  : "No bio yet.")}
            </Text>
            <FollowCounts
              followers={counts.data?.followers}
              following={counts.data?.following}
              isLoading={counts.isLoading}
              username={profile.username ?? ""}
            />
            {!isOwn && (followStatus.isError || followToggle.isError) ? (
              <FeedbackState
                actionLabel="Retry"
                className="w-full"
                onAction={() => {
                  if (followStatus.isError) {
                    void followStatus.refetch();
                  } else {
                    followToggle.mutate(!(followStatus.data ?? false));
                  }
                }}
                title={
                  followToggle.error?.message ??
                  "Couldn’t load the follow status."
                }
                variant="error"
              />
            ) : null}
          </View>
        </View>
      </View>
      {counts.isError ? (
        <FeedbackState
          actionLabel="Retry"
          onAction={() => void counts.refetch()}
          title="Couldn’t load follow totals."
          variant="error"
        />
      ) : null}
    </View>
  );
  const profileTabs = (
    <>
      {isOwn ? (
        <View
          accessibilityRole="tablist"
          className={
            isWide
              ? "mb-1 flex-row gap-2 rounded-lg border border-border bg-card p-2"
              : "flex-row gap-2"
          }
        >
          {(["posts", "picks"] as const).map((item) => (
            <Button
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item }}
              size="sm"
              variant={tab === item ? "default" : "outline"}
              onPress={() => setTab(item)}
            >
              <Text>{item === "posts" ? "Posts" : "Picks"}</Text>
            </Button>
          ))}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={isOwnProfile ? ["left", "right"] : ["bottom"]}
    >
      {isWide ? (
        <ScrollView
          className="min-h-0 flex-1"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={
                counts.isRefetching ||
                posts.isRefetching ||
                (isOwn && picks.isRefetching) ||
                followStatus.isRefetching
              }
              onRefresh={() => void refresh()}
            />
          }
        >
          <View
            className={pageContainerClassName("extraWide", "gap-3 px-6 py-6")}
          >
            <View className="flex-row items-start justify-center gap-3">
              <View className="min-w-0 flex-1 gap-1" style={{ maxWidth: 640 }}>
                {profileTabs}
                {listItems.length === 0 ? (
                  tab === "posts" ? (
                    <ProfilePostsEmpty
                      isError={posts.isError}
                      isLoading={posts.isLoading}
                      retry={() => void posts.refetch()}
                    />
                  ) : (
                    <ProfilePicksEmpty
                      isError={picks.isError}
                      isLoading={picks.isLoading}
                      retry={() => void picks.refetch()}
                    />
                  )
                ) : (
                  listItems.map((item) => (
                    <View key={`${item.type}:${item.item.id}`}>
                      {item.type === "pick" ? (
                        <PickRow pick={item.item} />
                      ) : item.item.post_type === "ASK" ? (
                        <AskPostCard post={item.item} />
                      ) : (
                        <SharePostCard
                          post={item.item}
                          entity={item.item.entity}
                        />
                      )}
                    </View>
                  ))
                )}
                {tab === "posts" && posts.hasNextPage ? (
                  <Button
                    disabled={posts.isFetchingNextPage}
                    variant="outline"
                    className="my-4 self-center"
                    onPress={() => void posts.fetchNextPage()}
                  >
                    {posts.isFetchingNextPage ? <ActivityIndicator /> : null}
                    <Text>
                      {posts.isFetchingNextPage ? "Loading…" : "Load more"}
                    </Text>
                  </Button>
                ) : null}
              </View>
              <View style={{ width: 400, flexShrink: 0 }}>
                {profileDetails}
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        <AppList
          className="flex-1"
          contentWidth="profile"
          contentContainerClassName="md:px-6 md:py-6"
          contentGap={4}
          data={listItems}
          keyExtractor={(item) => `${item.type}:${item.item.id}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="gap-1 py-1">
              {profileDetails}
              {profileTabs}
            </View>
          }
          ListEmptyComponent={
            <PageListContainer width={listContentWidth}>
              {tab === "posts" ? (
                <ProfilePostsEmpty
                  isError={posts.isError}
                  isLoading={posts.isLoading}
                  retry={() => void posts.refetch()}
                />
              ) : (
                <ProfilePicksEmpty
                  isError={picks.isError}
                  isLoading={picks.isLoading}
                  retry={() => void picks.refetch()}
                />
              )}
            </PageListContainer>
          }
          ListFooterComponent={
            tab === "posts" && posts.hasNextPage ? (
              <PageListContainer width={listContentWidth} className="my-4">
                <Button
                  disabled={posts.isFetchingNextPage}
                  variant="outline"
                  className="self-center"
                  onPress={() => void posts.fetchNextPage()}
                >
                  {posts.isFetchingNextPage ? <ActivityIndicator /> : null}
                  <Text>
                    {posts.isFetchingNextPage ? "Loading…" : "Load more"}
                  </Text>
                </Button>
              </PageListContainer>
            ) : undefined
          }
          renderItem={({ item }) => (
            <PageListContainer width={listContentWidth}>
              {item.type === "pick" ? (
                <PickRow pick={item.item} />
              ) : item.item.post_type === "ASK" ? (
                <AskPostCard post={item.item} />
              ) : (
                <SharePostCard post={item.item} entity={item.item.entity} />
              )}
            </PageListContainer>
          )}
          refreshControl={
            <RefreshControl
              refreshing={
                counts.isRefetching ||
                posts.isRefetching ||
                (isOwn && picks.isRefetching) ||
                followStatus.isRefetching
              }
              onRefresh={() => void refresh()}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function ProfilePostsEmpty({
  isError,
  isLoading,
  retry,
}: {
  isError: boolean;
  isLoading: boolean;
  retry: () => void;
}) {
  if (isLoading) {
    return (
      <View className="gap-3 pt-3">
        <ActivityIndicator />
        <Text variant="muted" className="self-center">
          Loading posts…
        </Text>
      </View>
    );
  }
  if (isError) {
    return (
      <FeedbackState
        actionLabel="Retry"
        onAction={retry}
        title="Couldn’t load posts."
        variant="error"
      />
    );
  }
  return <FeedbackState title="No posts yet" />;
}

function ProfilePicksEmpty({
  isError,
  isLoading,
  retry,
}: {
  isError: boolean;
  isLoading: boolean;
  retry: () => void;
}) {
  if (isLoading) {
    return (
      <View className="gap-3 pt-3">
        <ActivityIndicator />
        <Text variant="muted" className="self-center">
          Loading Picks…
        </Text>
      </View>
    );
  }
  if (isError) {
    return (
      <FeedbackState
        actionLabel="Retry"
        onAction={retry}
        title="Couldn’t load Picks."
        variant="error"
      />
    );
  }
  return <FeedbackState title="No Picks yet" />;
}

function FollowCounts({
  followers,
  following,
  isLoading,
  username,
}: {
  followers?: number;
  following?: number;
  isLoading: boolean;
  username: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Link href={routes.followers(username)} asChild>
        <Pressable accessibilityRole="link" className="py-1 active:opacity-70">
          <Count label="Followers" value={followers} isLoading={isLoading} />
        </Pressable>
      </Link>
      <View className="size-1 rounded-full bg-muted-foreground/70" />
      <Link href={routes.following(username)} asChild>
        <Pressable accessibilityRole="link" className="py-1 active:opacity-70">
          <Count label="Following" value={following} isLoading={isLoading} />
        </Pressable>
      </Link>
    </View>
  );
}

function Count({
  isLoading,
  label,
  value,
}: {
  isLoading: boolean;
  label: string;
  value?: number;
}) {
  return (
    <View className="flex-row items-center gap-1">
      {isLoading ? (
        <Skeleton className="h-4 w-6" />
      ) : (
        <Text className="text-sm font-semibold">{value ?? 0}</Text>
      )}
      <Text variant="muted">{label}</Text>
    </View>
  );
}
