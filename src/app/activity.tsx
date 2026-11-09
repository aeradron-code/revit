import { Link, router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { FlatList, View } from "react-native";

import type { ActivityNotification } from "@/api/notifications";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { shouldAutoMarkRead } from "@/features/activity/mark-read";
import { routes } from "@/lib/routes";
import { useAuthUser } from "@/providers/auth-provider";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/queries/notifications";

export default function ActivityScreen() {
  const user = useAuthUser();
  const notifications = useNotifications(user?.id);
  const markRead = useMarkNotificationsRead(user?.id);
  const markReadPending = markRead.isPending;
  const markReadNow = markRead.mutate;
  const resetMarkRead = markRead.reset;
  const lastAutoAttempt = useRef<string | null>(null);
  const lastUserId = useRef(user?.id);
  const unreadIds = (notifications.data ?? [])
    .filter((notification) => notification.read_at === null)
    .map((notification) => notification.id)
    .sort();
  const unreadKey =
    user?.id && unreadIds.length
      ? JSON.stringify([user.id, ...unreadIds])
      : null;

  useEffect(() => {
    if (lastUserId.current === user?.id) return;
    lastUserId.current = user?.id;
    lastAutoAttempt.current = null;
    resetMarkRead();
  }, [user?.id, resetMarkRead]);

  useEffect(() => {
    if (!unreadKey) {
      lastAutoAttempt.current = null;
      return;
    }
    if (
      !shouldAutoMarkRead({
        unreadKey,
        lastAutoAttempt: lastAutoAttempt.current,
        pending: markReadPending,
        failed: markRead.isError,
      })
    )
      return;
    lastAutoAttempt.current = unreadKey;
    markReadNow();
  }, [unreadKey, markReadNow, markReadPending, markRead.isError]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.home);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <Stack.Screen
        options={{
          header: () => (
            <AppHeader showAccountActions title="Activity" onBack={goBack} />
          ),
        }}
      />
      <FlatList
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-3 px-2 py-3 md:py-6"
        data={notifications.data ?? []}
        keyExtractor={(notification) => notification.id}
        ListHeaderComponent={
          <View className="gap-4">
            <Text variant="muted">Your latest social activity.</Text>
            {notifications.isLoading ? <ActivityListSkeleton /> : null}
            {notifications.isError ? (
              <FeedbackState
                actionLabel="Retry"
                onAction={() => void notifications.refetch()}
                title="Couldn’t load activity."
                variant="error"
              />
            ) : null}
            {markRead.isError && unreadKey ? (
              <FeedbackState
                actionLabel="Retry"
                onAction={() => markReadNow()}
                title="Couldn’t mark activity as read."
                variant="error"
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !notifications.isLoading && !notifications.isError ? (
            <EmptyActivity />
          ) : undefined
        }
        renderItem={({ item }) => <ActivityItem notification={item} />}
      />
    </SafeAreaView>
  );
}

function EmptyActivity() {
  return (
    <FeedbackState
      description="Follows, ratings, comments, replies, forum activity, and report reviews will appear here."
      title="Nothing new yet"
    />
  );
}

function ActivityItem({
  notification,
}: {
  notification: ActivityNotification;
}) {
  const destination =
    notification.notification_type === "REPORT_REVIEWED"
      ? null
      : notification.post_id
        ? routes.post(notification.post_id)
        : notification.forum_id
          ? routes.forum(notification.forum_id)
          : routes.user(notification.actor.username);

  const content = (
    <Button
      className="w-full items-center gap-3 border border-border bg-card"
      size="content"
      variant="ghost"
    >
      <View className="size-8 items-center justify-center rounded-full bg-selected">
        <Text className="font-bold text-primary">
          {(notification.actor.display_name ?? "?").slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-sm leading-5">
          <Text className="font-semibold">
            {notification.actor.display_name}
          </Text>{" "}
          {activityMessage(notification)}
        </Text>
        <Text variant="muted" className="text-xs">
          {formatRelativeTime(notification.created_at)}
        </Text>
      </View>
      {notification.read_at === null ? (
        <View className="mt-2 size-2 rounded-full bg-primary" />
      ) : null}
    </Button>
  );

  return destination ? (
    <Link href={destination} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

function ActivityListSkeleton() {
  return (
    <View accessibilityLabel="Loading activity" className="gap-2">
      {["first", "second", "third"].map((key) => (
        <View
          key={key}
          className="w-full flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
        >
          <Skeleton className="size-8 rounded-full" />
          <View className="min-w-0 flex-1 gap-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/4" />
          </View>
          <Skeleton className="size-2 rounded-full" />
        </View>
      ))}
    </View>
  );
}

function activityMessage(notification: ActivityNotification) {
  switch (notification.notification_type) {
    case "FOLLOW":
      return "started following you.";
    case "ASK_RATING":
      return "rated your Ask.";
    case "COMMENT":
      return "commented on your post.";
    case "REPLY":
      return "replied to your comment.";
    case "FORUM_JOIN":
      return "joined your forum.";
    case "FORUM_POST":
      return "posted in your forum.";
    case "REPORT_REVIEWED":
      return "reviewed your report.";
  }
}

function formatRelativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 1000),
  );
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}
