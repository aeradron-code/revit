import { supabase } from "@/lib/supabase/client";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  ApiError,
  normalizeApiError,
} from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

export type Profile = Tables<"profiles">;

export type FollowCounts = {
  followers: number;
  following: number;
};

export type UpdateProfileInput = Pick<
  TablesUpdate<"profiles">,
  "display_name" | "username"
>;

export function getProfile(
  userId: string,
  requestSignal?: AbortSignal,
): Promise<Profile | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, bio, avatar_url, onboarding_completed_at, created_at, updated_at",
        )
        .eq("id", userId)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_YOUR_PROFILE,
        errorResponseStatus,
      );

      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getProfileByUsername(
  username: string,
  requestSignal?: AbortSignal,
): Promise<Profile | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, bio, avatar_url, onboarding_completed_at, created_at, updated_at",
        )
        .eq("username", username)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_THIS_PROFILE,
        errorResponseStatus,
      );

      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getFollowCounts(
  profileId: string,
  requestSignal?: AbortSignal,
): Promise<FollowCounts> {
  return runApiRequest(
    async (signal) => {
      const [followersResult, followingResult] = await Promise.all([
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("following_id", profileId)
          .abortSignal(signal),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("follower_id", profileId)
          .abortSignal(signal),
      ]);

      throwIfSupabaseError(
        followersResult.error,
        API_ERROR_MESSAGES.LOAD_FOLLOWER_TOTALS,
        followersResult.status,
      );

      throwIfSupabaseError(
        followingResult.error,
        API_ERROR_MESSAGES.LOAD_FOLLOWING_TOTALS,
        followingResult.status,
      );

      if (followersResult.count === null) {
        throw normalizeApiError(
          undefined,
          API_ERROR_MESSAGES.LOAD_FOLLOWER_TOTALS,
        );
      }
      if (followingResult.count === null) {
        throw normalizeApiError(
          undefined,
          API_ERROR_MESSAGES.LOAD_FOLLOWING_TOTALS,
        );
      }

      return {
        followers: followersResult.count,
        following: followingResult.count,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("profiles")
      .update({ ...input, onboarding_completed_at: new Date().toISOString() })
      .eq("id", userId)
      .select(
        "id, username, display_name, bio, avatar_url, onboarding_completed_at, created_at, updated_at",
      )
      .abortSignal(signal)
      .single();

    if (error) {
      if (
        error.code === "23505" &&
        error.message.includes("profiles_username_key")
      ) {
        throw new ApiError(API_ERROR_MESSAGES.USERNAME_TAKEN, {
          cause: error,
          code: API_ERROR_CODES.USERNAME_TAKEN,
          fieldErrors: { username: API_ERROR_MESSAGES.USERNAME_TAKEN },
        });
      }
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.UPDATE_YOUR_PROFILE,
        errorResponseStatus,
      );
    }

    return data;
  });
}
