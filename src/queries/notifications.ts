import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
} from "@/api/notifications";
import { queryKeys } from "@/lib/query/query-keys";

export function useNotifications(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("You must be signed in to view activity.");
      return getNotifications(userId, 0, signal);
    },
    queryKey: queryKeys.notifications.list(userId ?? ""),
    staleTime: 15_000,
  });
}

export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("You must be signed in to view activity.");
      return getUnreadNotificationCount(userId, signal);
    },
    queryKey: queryKeys.notifications.unread(userId ?? ""),
    staleTime: 15_000,
  });
}

export function useMarkNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("You must be signed in to update activity.");
      return markNotificationsRead(userId);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.list(userId ?? ""),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.unread(userId ?? ""),
        }),
      ]),
  });
}
