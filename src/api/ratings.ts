import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { API_ERROR_MESSAGES, validationError } from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

export type Rating = Tables<"ratings">;
export type RatingSummary = {
  averageScore: number | null;
  ratingCount: number;
};

const RATING_SELECT =
  "post_id, rater_id, score, created_at, updated_at" as const;

export function getAskRatingSummary(
  postId: string,
  requestSignal?: AbortSignal,
): Promise<RatingSummary> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .rpc("get_ask_rating_summary", { target_post_id: postId })
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_THE_RATING_SUMMARY,
        errorResponseStatus,
      );

      const summary = data[0];

      return {
        averageScore: summary?.average_score ?? null,
        ratingCount: summary?.rating_count ?? 0,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getMyAskRating(
  postId: string,
  raterId: string,
  requestSignal?: AbortSignal,
): Promise<Rating | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("ratings")
        .select(RATING_SELECT)
        .eq("post_id", postId)
        .eq("rater_id", raterId)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_YOUR_RATING,
        errorResponseStatus,
      );

      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

export async function saveAskRating(
  postId: string,
  raterId: string,
  score: number,
): Promise<Rating> {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw validationError(API_ERROR_MESSAGES.CHOOSE_A_RATING_FROM_1_TO_5, {
      score: API_ERROR_MESSAGES.CHOOSE_A_RATING_FROM_1_TO_5,
    });
  }

  return runApiRequest(async (signal) => {
    const { data, error, status } = await supabase
      .rpc("save_ask_rating", {
        p_post_id: postId,
        p_rater_id: raterId,
        p_score: score,
      })
      .abortSignal(signal)
      .single();
    throwIfSupabaseError(error, API_ERROR_MESSAGES.UPDATE_YOUR_RATING, status);
    return data;
  });
}

export function deleteAskRating(
  postId: string,
  raterId: string,
): Promise<void> {
  // Idempotent: an absent or RLS-hidden rating has the same successful outcome.
  return runApiRequest(async (signal) => {
    const { error, status: errorResponseStatus } = await supabase
      .from("ratings")
      .delete()
      .eq("post_id", postId)
      .eq("rater_id", raterId)
      .abortSignal(signal);

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.REMOVE_YOUR_RATING,
      errorResponseStatus,
    );
  });
}
