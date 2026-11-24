import { throwIfSupabaseError } from "./supabase-errors";
import type { PostPage, PostWithDetails } from "@/api/posts";
import { getGlobalPostsByAuthor, getGlobalPostsByIds } from "@/api/posts";
import type { Entity } from "@/api/entities";
import { getEntitiesByIds } from "@/api/entities";
import { supabase } from "@/lib/supabase/client";

import { API_ERROR_MESSAGES, normalizeApiError } from "./errors";
import { runApiRequest } from "./request";

const HOME_FEED_PAGE_SIZE = 10;

export type HomeFeedSharePost = PostWithDetails & {
  post_type: "SHARE";
  ratingScore: number;
  entity: Entity;
};

export type HomeFeedPost =
  | (PostWithDetails & { post_type: "ASK" })
  | HomeFeedSharePost;

export type HomeFeedPage = Omit<PostPage, "items" | "nextOffset"> & {
  items: HomeFeedPost[];
  nextCursor?: HomeFeedCursor;
};

export type ProfilePostsPage = Omit<PostPage, "items"> & {
  items: HomeFeedPost[];
};

export type HomeFeedCursor = {
  createdAt: string;
  id: string;
};

export type HomeFeedMode = "following" | "for-you";

export async function getHomeFeed(
  mode: HomeFeedMode,
  cursor?: HomeFeedCursor,
  requestSignal?: AbortSignal,
): Promise<HomeFeedPage> {
  const feedRows = await runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .rpc("get_home_feed", {
          p_before_created_at: cursor?.createdAt,
          p_before_id: cursor?.id,
          p_limit: HOME_FEED_PAGE_SIZE + 1,
          p_mode: mode,
        })
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_YOUR_FEED,
        errorResponseStatus,
      );

      return data;
    },
    { retries: 1, signal: requestSignal },
  );

  const hasNextPage = feedRows.length > HOME_FEED_PAGE_SIZE;
  const visibleRows = feedRows.slice(0, HOME_FEED_PAGE_SIZE);
  const visiblePostIds = visibleRows.map((post) => post.id);
  const lastRow = visibleRows.at(-1);
  const nextCursor =
    hasNextPage && lastRow
      ? { createdAt: lastRow.created_at, id: lastRow.id }
      : undefined;

  const posts = await getGlobalPostsByIds(visiblePostIds, requestSignal);
  return {
    items: await addShareDetails(posts, requestSignal),
    nextCursor,
  };
}

export async function getProfilePostsByAuthor(
  authorId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<ProfilePostsPage> {
  const page = await getGlobalPostsByAuthor(authorId, offset, requestSignal);
  return {
    ...page,
    items: await addShareDetails(
      page.items,
      requestSignal,
      API_ERROR_MESSAGES.LOAD_PROFILE_POSTS,
    ),
  };
}

async function addShareDetails(
  posts: PostWithDetails[],
  requestSignal?: AbortSignal,
  errorMessage: string = API_ERROR_MESSAGES.LOAD_YOUR_FEED,
): Promise<HomeFeedPost[]> {
  if (posts.some((post) => post.post_type === "SHARE" && !post.entity_id)) {
    throw normalizeApiError(new Error("Share has no entity"), errorMessage);
  }
  const sharePosts = posts.filter(
    (
      post,
    ): post is PostWithDetails & { entity_id: string; post_type: "SHARE" } =>
      post.post_type === "SHARE" && post.entity_id !== null,
  );

  if (sharePosts.length === 0) {
    return posts as HomeFeedPost[];
  }

  const [ratings, entities] = await Promise.all([
    getShareScores(
      sharePosts.map((post) => post.id),
      requestSignal,
    ),
    getEntitiesByIds(
      sharePosts.map((post) => post.entity_id),
      requestSignal,
    ),
  ]);
  const ratingsByPostId = new Map(
    ratings.map((rating) => [rating.post_id, rating.score]),
  );
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));

  return posts.flatMap((post) => {
    if (post.post_type === "ASK") return [post as HomeFeedPost];

    const ratingScore = ratingsByPostId.get(post.id);
    const entity = post.entity_id
      ? entitiesById.get(post.entity_id)
      : undefined;

    if (ratingScore === undefined || !entity) {
      throw normalizeApiError(
        new Error("Share data is incomplete"),
        errorMessage,
      );
    }
    return [
      {
        ...post,
        post_type: "SHARE" as const,
        ratingScore,
        entity,
      },
    ];
  });
}

function getShareScores(postIds: string[], requestSignal?: AbortSignal) {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("entity_ratings")
        .select("post_id, score")
        .in("post_id", postIds)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_SHARE_RATINGS,
        errorResponseStatus,
      );

      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}
