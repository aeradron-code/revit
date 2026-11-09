import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { API_ERROR_MESSAGES, normalizeApiError } from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

export type Report = Tables<"reports">;
export type ReportTargetType =
  | "comment"
  | "entity"
  | "forum"
  | "pick"
  | "post"
  | "user";
export type ReportReason =
  | "harassment"
  | "impersonation"
  | "inappropriate"
  | "other"
  | "spam";

export function submitContentReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
}): Promise<string> {
  return runApiRequest(async (signal) => {
    const { data, error, status } = await supabase
      .rpc("submit_content_report", {
        p_target_type: input.targetType,
        p_target_id: input.targetId,
        p_reason: input.reason,
        p_details: input.details.trim() || null,
      })
      .abortSignal(signal);
    throwIfSupabaseError(error, API_ERROR_MESSAGES.SUBMIT_REPORT, status);
    if (!data)
      throw normalizeApiError(undefined, API_ERROR_MESSAGES.SUBMIT_REPORT);
    return data;
  });
}

export function getMyBlockStatus(
  blockedId: string,
  requestSignal?: AbortSignal,
): Promise<boolean> {
  return runApiRequest(
    async (signal) => {
      const { data, error, status } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocked_id", blockedId)
        .abortSignal(signal)
        .maybeSingle();
      throwIfSupabaseError(error, API_ERROR_MESSAGES.LOAD_BLOCKS, status);
      return Boolean(data);
    },
    { retries: 1, signal: requestSignal },
  );
}

export function setUserBlocked(
  blockerId: string,
  blockedId: string,
  blocked: boolean,
): Promise<void> {
  return runApiRequest(async (signal) => {
    const query = blocked
      ? supabase.from("user_blocks").insert({
          blocker_id: blockerId,
          blocked_id: blockedId,
        })
      : supabase
          .from("user_blocks")
          .delete()
          .eq("blocker_id", blockerId)
          .eq("blocked_id", blockedId);
    const { error, status } = await query.abortSignal(signal);
    throwIfSupabaseError(error, API_ERROR_MESSAGES.UPDATE_BLOCK, status);
  });
}

export function getReports(requestSignal?: AbortSignal): Promise<Report[]> {
  return runApiRequest(
    async (signal) => {
      const { data, error, status } = await supabase
        .from("reports")
        .select(
          "id, reporter_id, reporter_summary, target_type, target_id, target_user_id, target_path, target_summary, reason, details, status, created_at, reviewed_at, reviewed_by",
        )
        .order("created_at", { ascending: false })
        .abortSignal(signal);
      throwIfSupabaseError(error, API_ERROR_MESSAGES.LOAD_REPORTS, status);
      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function markReportReviewed(
  reportId: string,
  adminId: string,
): Promise<void> {
  return runApiRequest(async (signal) => {
    const { error, status } = await supabase
      .from("reports")
      .update({
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        status: "reviewed",
      })
      .eq("id", reportId)
      .eq("status", "pending")
      .abortSignal(signal);
    throwIfSupabaseError(error, API_ERROR_MESSAGES.REVIEW_REPORT, status);
  });
}
