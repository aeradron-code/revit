import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, View } from "react-native";

import type { FollowProfile } from "@/api/follows";
import { AppHeader } from "@/components/navigation/app-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { FeedbackState } from "@/components/ui/feedback-state";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { getInitials } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useFollowList } from "@/queries/follows";
import { useProfileByUsername } from "@/queries/profiles";

type FollowListScreenProps = {
  kind: "followers" | "following";
};

export function FollowListScreen({ kind }: FollowListScreenProps) {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username)
    ? params.username[0]
    : (params.username ?? "");
  const profile = useProfileByUsername(username.toLowerCase());
  const list = useFollowList(profile.data?.id ?? "", kind);
  const title = kind === "followers" ? "Followers" : "Following";
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.user(username));
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader showAccountActions title={title} onBack={goBack} />
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="w-full grow px-6 md:mx-auto md:max-w-3xl md:px-6 md:py-6"
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          <FollowListState
            profileLoading={profile.isLoading}
            profileMissing={!profile.isLoading && !profile.data}
            listLoading={list.isLoading}
            isError={profile.isError || list.isError}
            kind={kind}
            retry={() =>
              void (profile.isError ? profile.refetch() : list.refetch())
            }
          />
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator className="my-5" />
          ) : undefined
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) {
            void list.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        renderItem={({ item }) => <FollowProfileRow profile={item} />}
        onRefresh={() => void list.refetch()}
      />
    </SafeAreaView>
  );
}

function FollowProfileRow({ profile }: { profile: FollowProfile }) {
  return (
    <Link href={routes.user(profile.username)} asChild>
      <Button
        variant="ghost"
        className="w-full gap-3 border border-border bg-card"
        size="content"
      >
        <Avatar alt={`${profile.display_name}'s avatar`} className="size-8">
          {profile.avatar_url ? (
            <AvatarImage
              accessibilityLabel={`${profile.display_name}'s avatar`}
              source={{ uri: profile.avatar_url }}
            />
          ) : null}
          <AvatarFallback>
            <Text className="font-semibold">
              {getInitials(profile.display_name)}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="min-w-0 flex-1 items-start gap-0.5">
          <Text className="font-semibold">{profile.display_name}</Text>
          <Text variant="muted">@{profile.username}</Text>
          {profile.bio?.trim() ? (
            <Text
              numberOfLines={1}
              variant="small"
              className="text-muted-foreground"
            >
              {profile.bio}
            </Text>
          ) : null}
        </View>
      </Button>
    </Link>
  );
}

function FollowListState({
  isError,
  kind,
  listLoading,
  profileLoading,
  profileMissing,
  retry,
}: {
  isError: boolean;
  kind: "followers" | "following";
  listLoading: boolean;
  profileLoading: boolean;
  profileMissing: boolean;
  retry: () => void;
}) {
  if (profileLoading || listLoading) {
    return (
      <View className="py-4">
        <ContentSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <FeedbackState
        actionLabel="Retry"
        className="my-4"
        onAction={retry}
        title="Couldn’t load this list."
        variant="error"
      />
    );
  }

  return (
    <FeedbackState
      className="my-4"
      description={
        profileMissing
          ? undefined
          : kind === "followers"
            ? "People who follow this profile will appear here."
            : "People followed by this profile will appear here."
      }
      title={
        profileMissing
          ? "Profile not found"
          : kind === "followers"
            ? "No followers yet"
            : "Not following anyone yet"
      }
    />
  );
}
