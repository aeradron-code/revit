import { Link, router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";

import type { ActivityNotification } from "@/api/notifications";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageScrollView } from "@/components/ui/page-scroll-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
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
      <PageScrollView contentContainerClassName="gap-5" contentWidth="narrow">
        <Text variant="muted">Your latest social activity.</Text>
        {notifications.isLoading ? <ContentSkeleton /> : null}
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
        {notifications.data?.length === 0 ? <EmptyActivity /> : null}
        {notifications.data?.map((notification) => (
          <ActivityItem key={notification.id} notification={notification} />
        ))}
      </PageScrollView>
    </SafeAreaView>
  );
}

function EmptyActivity() {
  return (
    <FeedbackState
      description="Follows, ratings, comments, replies, and forum activity will appear here."
      title="Nothing new yet"
    />
  );
}

function ActivityItem({
  notification,
}: {
  notification: ActivityNotification;
}) {
  const destination = notification.post_id
    ? routes.post(notification.post_id)
    : notification.forum_id
      ? routes.forum(notification.forum_id)
      : routes.user(notification.actor.username);

  return (
    <Link href={destination} asChild>
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
    </Link>
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
