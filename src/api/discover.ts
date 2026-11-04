import type { Entity } from "@/api/entities";
import { searchEntities } from "@/api/entities";
import { supabase } from "@/lib/supabase/client";
import { API_ERROR_MESSAGES } from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

const DISCOVER_RESULT_LIMIT = 8;

export type DiscoveryProfile = {
  avatarUrl: string | null;
  displayName: string;
  username: string;
};

export type DiscoveryPost = {
  authorName: string;
  body: string | null;
  id: string;
  postType: "ASK" | "SHARE";
};

export type DiscoverResults = {
  posts: DiscoveryPost[];
  profiles: DiscoveryProfile[];
  entities: Entity[];
};

export function discover(
  query: string,
  requestSignal?: AbortSignal,
): Promise<DiscoverResults> {
  const searchTerm = normalizeSearchTerm(query);

  if (searchTerm.length < 2) {
    return Promise.resolve({ posts: [], profiles: [], entities: [] });
  }

  const pattern = `%${escapeLikePattern(searchTerm)}%`;

  return runApiRequest(
    async (signal) => {
      const [profilesResult, postsResult, entities] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .not("username", "is", null)
          .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
          .order("username", { ascending: true })
          .limit(DISCOVER_RESULT_LIMIT)
          .abortSignal(signal),
        supabase
          .from("posts")
          .select(
            "id, post_type, body, author:profiles!posts_author_id_fkey(display_name)",
          )
          .ilike("body", pattern)
          .is("forum_id", null)
          .order("created_at", { ascending: false })
          .limit(DISCOVER_RESULT_LIMIT)
          .abortSignal(signal),
        searchEntities(searchTerm, undefined, signal),
      ]);

      throwIfSupabaseError(
        profilesResult.error,
        API_ERROR_MESSAGES.SEARCH_PEOPLE,
        profilesResult.status,
      );

      throwIfSupabaseError(
        postsResult.error,
        API_ERROR_MESSAGES.SEARCH_POSTS,
        postsResult.status,
      );

      return {
        posts: postsResult.data.map((post) => ({
          authorName: post.author.display_name ?? "Unknown user",
          body: post.body,
          id: post.id,
          postType: post.post_type,
        })),
        profiles: profilesResult.data.map((profile) => ({
          avatarUrl: profile.avatar_url,
          displayName: profile.display_name ?? "Unknown user",
          username: profile.username ?? "",
        })),
        entities,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
