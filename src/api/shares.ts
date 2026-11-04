import type {
  AskCreationAttempt,
  AskImageUpload,
  Post,
  PostPage,
  PostWithDetails,
} from "@/api/posts";
import {
  createIdempotentPost,
  getSharePostsByEntity as loadSharePostsByEntity,
} from "@/api/posts";
import { supabase } from "@/lib/supabase/client";
import {
  API_ERROR_MESSAGES,
  normalizeApiError,
  unauthenticatedError,
  validationError,
} from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type MyEntityRating = {
  body: string | null;
  postId: string;
  score: number;
};

export type EntityRatingSummary = {
  averageScore: number | null;
  ratingCount: number;
};

export type SharePostWithDetails = PostWithDetails & {
  ratingScore: number;
};

export type SharePostPage = Omit<PostPage, "items"> & {
  items: SharePostWithDetails[];
};

export type CreateShareRatingInput = {
  attempt: AskCreationAttempt;
  authorId: string;
  body?: string;
  entityId: string;
  images: AskImageUpload[];
  score: number;
};

export function getMyEntityRating(
  entityId: string,
  authorId: string,
  requestSignal?: AbortSignal,
): Promise<MyEntityRating | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("entity_ratings")
        .select("post_id, score, post:posts!entity_ratings_post_id_fkey(body)")
        .eq("entity_id", entityId)
        .eq("author_id", authorId)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_YOUR_RATING,
        errorResponseStatus,
      );

      if (!data) return null;

      if (!data.post) {
        throw normalizeApiError(undefined, API_ERROR_MESSAGES.LOAD_YOUR_RATING);
      }

      return {
        body: data.post.body,
        postId: data.post_id,
        score: data.score,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getEntityRatingSummary(
  entityId: string,
  requestSignal?: AbortSignal,
): Promise<EntityRatingSummary> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .rpc("get_entity_rating_summary", { p_entity_id: entityId })
        .abortSignal(signal)
        .single();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_THIS_FIND_S_RATING,
        errorResponseStatus,
      );

      return {
        averageScore: data.average_score,
        ratingCount: data.rating_count,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getShareRatingScore(
  postId: string,
  requestSignal?: AbortSignal,
): Promise<number | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data: forumRating,
        error: forumRatingError,
        status: forumRatingErrorResponseStatus,
      } = await supabase
        .from("forum_share_ratings")
        .select("score")
        .eq("post_id", postId)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        forumRatingError,
        API_ERROR_MESSAGES.LOAD_THIS_RATING,
        forumRatingErrorResponseStatus,
      );
      if (forumRating) return forumRating.score;

      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("entity_ratings")
        .select("score")
        .eq("post_id", postId)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_THIS_RATING,
        errorResponseStatus,
      );

      return data?.score ?? null;
    },
    { retries: 1, signal: requestSignal },
  );
}

export async function getSharePostsForEntity(
  entityId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<SharePostPage> {
  const page = await loadSharePostsByEntity(entityId, offset, requestSignal);

  if (page.items.length === 0) return { ...page, items: [] };

  const scores = await runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("entity_ratings")
        .select("post_id, score")
        .in(
          "post_id",
          page.items.map((post) => post.id),
        )
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_RATINGS,
        errorResponseStatus,
      );

      return new Map(data.map((rating) => [rating.post_id, rating.score]));
    },
    { retries: 1, signal: requestSignal },
  );

  return {
    ...page,
    items: page.items.flatMap((post) => {
      const ratingScore = scores.get(post.id);
      if (ratingScore === undefined) {
        throw normalizeApiError(
          new Error("Share rating is missing"),
          API_ERROR_MESSAGES.LOAD_RATINGS,
        );
      }
      return [{ ...post, ratingScore }];
    }),
  };
}

export async function createShareRating(
  input: CreateShareRatingInput,
): Promise<Post> {
  validateShareRating(input);

  return createIdempotentPost({ ...input, kind: "GLOBAL_SHARE" });
}

export async function updateShareRating(
  postId: string,
  input: Pick<CreateShareRatingInput, "body" | "score">,
): Promise<Post> {
  validateScore(input.score);

  if ((input.body?.trim().length ?? 0) > 2_000) {
    throw validationError(
      API_ERROR_MESSAGES.THE_REVIEW_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      {
        body: API_ERROR_MESSAGES.THE_REVIEW_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      },
    );
  }

  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .rpc("update_share_rating_post", {
        p_body: nullIfBlank(input.body),
        p_post_id: postId,
        p_score: input.score,
      })
      .abortSignal(signal)
      .single();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.UPDATE_YOUR_RATING,
      errorResponseStatus,
    );

    return data;
  });
}

function validateShareRating(input: CreateShareRatingInput) {
  if (!input.authorId || !input.entityId) {
    if (!input.authorId)
      throw unauthenticatedError(
        API_ERROR_MESSAGES.YOU_MUST_BE_SIGNED_IN_TO_CREATE_A_POST,
      );
    throw validationError(API_ERROR_MESSAGES.CHOOSE_A_FIND_BEFORE_PUBLISHING, {
      entityId: API_ERROR_MESSAGES.CHOOSE_A_FIND_BEFORE_PUBLISHING,
    });
  }

  validateScore(input.score);

  if ((input.body?.trim().length ?? 0) > 2_000) {
    throw validationError(
      API_ERROR_MESSAGES.THE_REVIEW_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      {
        body: API_ERROR_MESSAGES.THE_REVIEW_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      },
    );
  }

  if (input.images.length > 3) {
    throw validationError(
      API_ERROR_MESSAGES.A_RATING_CAN_CONTAIN_UP_TO_THREE_IMAGES,
      { images: API_ERROR_MESSAGES.A_RATING_CAN_CONTAIN_UP_TO_THREE_IMAGES },
    );
  }

  for (const image of input.images) {
    if (
      image.data.byteLength === 0 ||
      image.data.byteLength > MAX_IMAGE_BYTES
    ) {
      throw validationError(
        API_ERROR_MESSAGES.EACH_IMAGE_MUST_BE_SMALLER_THAN_10_MB,
        { images: API_ERROR_MESSAGES.EACH_IMAGE_MUST_BE_SMALLER_THAN_10_MB },
      );
    }
  }
}

function validateScore(score: number) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw validationError(API_ERROR_MESSAGES.CHOOSE_A_RATING_FROM_1_TO_5, {
      score: API_ERROR_MESSAGES.CHOOSE_A_RATING_FROM_1_TO_5,
    });
  }
}

function nullIfBlank(value: string | undefined) {
  return value?.trim() || undefined;
}
