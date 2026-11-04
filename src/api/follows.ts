import { supabase } from "@/lib/supabase/client";
import { API_ERROR_MESSAGES } from "./errors";
import type { Profile } from "./profiles";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

const FOLLOW_PAGE_SIZE = 20;

export type FollowProfile = Pick<
  Profile,
  "avatar_url" | "bio" | "display_name" | "id" | "username"
>;

export type FollowPage = {
  items: FollowProfile[];
  nextOffset?: number;
};

export function getFollowStatus(
  followerId: string,
  followingId: string,
  requestSignal?: AbortSignal,
): Promise<boolean> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", followerId)
        .eq("following_id", followingId)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.CHECK_THE_FOLLOW_STATUS,
        errorResponseStatus,
      );

      return data !== null;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function followProfile(
  followerId: string,
  followingId: string,
): Promise<void> {
  return runApiRequest(async (signal) => {
    const { error, status: errorResponseStatus } = await supabase
      .from("follows")
      .insert({ follower_id: followerId, following_id: followingId })
      .abortSignal(signal);

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.FOLLOW_THIS_PERSON,
      errorResponseStatus,
    );
  });
}

export function unfollowProfile(
  followerId: string,
  followingId: string,
): Promise<void> {
  // Idempotent: zero affected rows, including rows blocked by RLS, are not distinguished.
  return runApiRequest(async (signal) => {
    const { error, status: errorResponseStatus } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .abortSignal(signal);

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.UNFOLLOW_THIS_PERSON,
      errorResponseStatus,
    );
  });
}

export function getFollowers(
  profileId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<FollowPage> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("follows")
        .select(
          "profile:profiles!follows_follower_id_fkey(id, username, display_name, bio, avatar_url)",
        )
        .eq("following_id", profileId)
        .order("created_at", { ascending: false })
        .order("follower_id", { ascending: true })
        .range(offset, offset + FOLLOW_PAGE_SIZE)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_FOLLOWERS,
        errorResponseStatus,
      );

      const hasNextPage = data.length > FOLLOW_PAGE_SIZE;

      return {
        items: data.slice(0, FOLLOW_PAGE_SIZE).map(({ profile }) => profile),
        nextOffset: hasNextPage ? offset + FOLLOW_PAGE_SIZE : undefined,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getFollowing(
  profileId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<FollowPage> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("follows")
        .select(
          "profile:profiles!follows_following_id_fkey(id, username, display_name, bio, avatar_url)",
        )
        .eq("follower_id", profileId)
        .order("created_at", { ascending: false })
        .order("following_id", { ascending: true })
        .range(offset, offset + FOLLOW_PAGE_SIZE)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_FOLLOWING,
        errorResponseStatus,
      );

      const hasNextPage = data.length > FOLLOW_PAGE_SIZE;

      return {
        items: data.slice(0, FOLLOW_PAGE_SIZE).map(({ profile }) => profile),
        nextOffset: hasNextPage ? offset + FOLLOW_PAGE_SIZE : undefined,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}
