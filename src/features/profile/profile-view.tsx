import { Link } from "expo-router";
import { UserCheck, UserPlus } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useMemo } from "react";
import type { Profile } from "@/api/profiles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Icon } from "@/components/ui/icon";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { AskPostCard } from "@/features/posts/ask-post-card";
import { getInitials } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import { useFollowStatus, useFollowToggle } from "@/queries/follows";
import { useAskPostsByAuthor } from "@/queries/posts";

import { useFollowCounts } from "@/queries/profiles";
import { SafetyOptionsMenu } from "@/features/safety/safety-options-menu";
import { useMyBlockStatus } from "@/queries/safety";

type ProfileViewProps = {
  isOwnProfile?: boolean;
  profile: Profile;
};

export function ProfileView({
  isOwnProfile = false,
  profile,
}: ProfileViewProps) {
  const user = useAuthUser();
  const isOwn = isOwnProfile || user?.id === profile.id;
  const counts = useFollowCounts(profile.id);
  const posts = useAskPostsByAuthor(profile.id);
  const postItems = useMemo(
    () => posts.data?.pages.flatMap((page) => page.items) ?? [],
    [posts.data],
  );
  const followStatus = useFollowStatus(user?.id ?? "", profile.id);
  const followToggle = useFollowToggle(user?.id ?? "", profile.id);
  const blockStatus = useMyBlockStatus(user?.id ?? "", profile.id);
  const initials = getInitials(profile.display_name);

  const refresh = async () => {
    await Promise.all([
      counts.refetch(),
      posts.refetch(),
      ...(isOwn ? [] : [followStatus.refetch()]),
    ]);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={isOwnProfile ? ["left", "right"] : ["bottom"]}
    >
      <FlatList
        className="flex-1"
        contentContainerClassName="w-full gap-1 md:mx-auto md:max-w-4xl md:px-6 md:py-6"
        data={postItems}
        keyExtractor={(post) => post.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-1 py-1">
            <View className="overflow-hidden md:rounded-xl border border-border bg-card">
              <View
                className="h-28 overflow-hidden sm:h-36"
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
                    <LinearGradient
                      id="profileCover"
                      x1="0"
                      y1="1"
                      x2="1"
                      y2="0"
                    >
                      <Stop offset="0" stopColor="#101b33" />
                      <Stop offset="1" stopColor="#2453ae" />
                    </LinearGradient>
                  </Defs>
                  <Rect width="900" height="144" fill="url(#profileCover)" />
                  <Circle
                    cx="125"
                    cy="180"
                    r="105"
                    fill="#142b58"
                    stroke="#2859ac"
                  />
                  <Circle
                    cx="760"
                    cy="310"
                    r="245"
                    fill="#16356c"
                    stroke="#2c62bd"
                  />
                </Svg>
              </View>
              <View className="px-5 pb-3 sm:flex-row sm:items-start sm:gap-5 sm:px-8 sm:pb-7">
                <Avatar
                  alt={`${profile.display_name}'s avatar`}
                  className="-mt-10 size-24 border-2 border-blue-500 shadow-none sm:-mt-8 sm:size-28"
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
                <View className="min-w-0 flex-1 gap-3 pt-3 sm:pt-5">
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
                              followStatus.data
                                ? "Unfollow user"
                                : "Follow user"
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
                          reportMenuLabel="Report"
                          blockMenuLabel="Block"
                          unblockMenuLabel="Unblock"
                          showReportIcon={false}
                          targetType="user"
                          triggerClassName="size-10 border border-border bg-card"
                        />
                      </View>
                    ) : null}
                  </View>
                  <Text className="max-w-2xl leading-6 text-foreground">
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
                    <Text variant="small" className="text-destructive">
                      {followToggle.error?.message ??
                        "We couldn’t load the follow status. Pull to refresh."}
                    </Text>
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
        }
        ListEmptyComponent={
          <ProfilePostsEmpty
            isError={posts.isError}
            isLoading={posts.isLoading}
            retry={() => void posts.refetch()}
          />
        }
        ListFooterComponent={
          posts.hasNextPage ? (
            <Button
              disabled={posts.isFetchingNextPage}
              variant="outline"
              className="my-4 self-center"
              onPress={() => void posts.fetchNextPage()}
            >
              {posts.isFetchingNextPage ? <ActivityIndicator /> : null}
              <Text>{posts.isFetchingNextPage ? "Loading…" : "Load more"}</Text>
            </Button>
          ) : undefined
        }
        renderItem={({ item }) => <AskPostCard post={item} />}
        refreshControl={
          <RefreshControl
            refreshing={
              counts.isRefetching ||
              posts.isRefetching ||
              followStatus.isRefetching
            }
            onRefresh={() => void refresh()}
          />
        }
      />
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
          Loading Ask posts…
        </Text>
      </View>
    );
  }
  if (isError) {
    return (
      <FeedbackState
        actionLabel="Retry"
        onAction={retry}
        title="Couldn’t load Ask posts."
        variant="error"
      />
    );
  }
  return (
    <FeedbackState
      className="mx-auto w-full max-w-xl self-center"
      title="No Ask posts yet"
    />
  );
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
