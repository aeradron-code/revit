import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { API_ERROR_MESSAGES, normalizeApiError } from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

const NOTIFICATION_PAGE_SIZE = 30;

export type ActivityNotification = Pick<
  Tables<"notifications">,
  | "id"
  | "recipient_id"
  | "actor_id"
  | "notification_type"
  | "post_id"
  | "comment_id"
  | "forum_id"
  | "created_at"
  | "read_at"
> & {
  actor: Pick<Tables<"profiles">, "display_name" | "username">;
};

export function getNotifications(
  recipientId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<ActivityNotification[]> {
  return runApiRequest(
    async (signal) => {
      const { data, error, status } = await supabase
        .from("notifications")
        .select(
          "id, recipient_id, actor_id, notification_type, post_id, comment_id, forum_id, created_at, read_at, actor:profiles!notifications_actor_id_fkey(display_name, username)",
        )
        .eq("recipient_id", recipientId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + NOTIFICATION_PAGE_SIZE - 1)
        .abortSignal(signal);

      throwIfSupabaseError(error, API_ERROR_MESSAGES.LOAD_ACTIVITY, status);

      return data.map((notification) => {
        if (!notification.actor) {
          throw normalizeApiError(
            new Error("Notification actor is missing"),
            API_ERROR_MESSAGES.LOAD_ACTIVITY,
          );
        }
        return { ...notification, actor: notification.actor };
      });
    },
    {
      message: API_ERROR_MESSAGES.LOAD_ACTIVITY,
      retries: 1,
      signal: requestSignal,
    },
  );
}

export function getUnreadNotificationCount(
  recipientId: string,
  requestSignal?: AbortSignal,
): Promise<number> {
  return runApiRequest(
    async (signal) => {
      const { count, error, status } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", recipientId)
        .is("read_at", null)
        .abortSignal(signal);

      throwIfSupabaseError(error, API_ERROR_MESSAGES.LOAD_ACTIVITY, status);

      if (count === null) throw new Error("Missing notification count");
      return count;
    },
    {
      message: API_ERROR_MESSAGES.LOAD_ACTIVITY,
      retries: 1,
      signal: requestSignal,
    },
  );
}

export function markNotificationsRead(recipientId: string): Promise<void> {
  return runApiRequest(
    async (signal) => {
      const { error, status } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", recipientId)
        .is("read_at", null)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.MARK_ACTIVITY_READ,
        status,
      );
    },
    { message: API_ERROR_MESSAGES.MARK_ACTIVITY_READ },
  );
}
