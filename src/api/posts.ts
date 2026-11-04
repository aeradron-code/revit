import { throwIfStorageError, throwIfSupabaseError } from "./supabase-errors";
import { supabase } from "@/lib/supabase/client";
import { randomUUID } from "expo-crypto";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import type { Entity } from "@/api/entities";
import { getEntitiesByIds } from "@/api/entities";

import {
  API_ERROR_MESSAGES,
  normalizeApiError,
  normalizeStorageError,
  unauthenticatedError,
  validationError,
} from "./errors";
import { runApiRequest } from "./request";

const POST_IMAGES_BUCKET = "post-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const POST_PAGE_SIZE = 10;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type Post = Tables<"posts">;
export type PostMedia = Tables<"post_media">;

export type PostAuthor = Pick<
  Tables<"profiles">,
  "avatar_url" | "display_name" | "id" | "username"
>;

export type PostWithDetails = Post & {
  author: PostAuthor;
  media: Array<PostMedia & { signedUrl: string }>;
  engagement?: PostEngagementSummary;
  forumShare?: { entity: Entity; ratingScore: number };
};

export type PostEngagementSummary = {
  averageScore: number | null;
  commentCount: number;
  ratingCount: number;
};

export type PostPage = {
  items: PostWithDetails[];
  nextOffset?: number;
};

export type UpdateAskPostInput = Pick<TablesUpdate<"posts">, "body">;

type RawPostWithDetails = Post & {
  author: PostAuthor;
  media: PostMedia[];
};

const POST_DETAILS_SELECT =
  "id, author_id, post_type, entity_id, forum_id, body, created_at, updated_at, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url), media:post_media(id, post_id, storage_path, position, alt_text, created_at)";

export type AskImageUpload = {
  contentType:
    | "image/heic"
    | "image/heif"
    | "image/jpeg"
    | "image/png"
    | "image/webp";
  data: ArrayBuffer;
  extension: "heic" | "heif" | "jpeg" | "jpg" | "png" | "webp";
};

export type CreateAskPostInput = {
  authorId: string;
  body?: string;
  images: AskImageUpload[];
};

export type AskCreationAttempt = {
  id: string;
  uploadedPaths?: string[];
  preparedImages?: AskImageUpload[];
  outcomeUncertain?: boolean;
};

export type AskCreationLookup =
  | { status: "confirmed"; post: Post }
  | { status: "inconclusive" };

export type IdempotentPostKind = "FORUM_ASK" | "FORUM_SHARE" | "GLOBAL_SHARE";

export function lookupPostCreation(
  operationId: string,
  kind: IdempotentPostKind,
  requestSignal?: AbortSignal,
): Promise<AskCreationLookup> {
  return runApiRequest(
    async (signal) => {
      const { data, error, status } = await supabase
        .rpc("lookup_post_creation", {
          p_operation_id: operationId,
          p_kind: kind,
        })
        .abortSignal(signal)
        .maybeSingle();
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.CHECK_ASK_CREATION,
        status,
      );
      return data
        ? { status: "confirmed", post: data }
        : { status: "inconclusive" };
    },
    {
      message: API_ERROR_MESSAGES.CHECK_ASK_CREATION,
      retries: 1,
      signal: requestSignal,
    },
  );
}

/** The caller must retain the attempt and the unchanged draft across retries. */
export async function createIdempotentPost(input: {
  attempt: AskCreationAttempt;
  authorId: string;
  body?: string;
  entityId?: string;
  forumId?: string;
  images: AskImageUpload[];
  kind: IdempotentPostKind;
  score?: number;
}): Promise<Post> {
  const { attempt } = input;
  const postId = attempt.id;
  let uploadedPaths = attempt.uploadedPaths;
  if (!uploadedPaths) {
    try {
      uploadedPaths = await uploadPostImages({
        authorId: input.authorId,
        images: input.images,
        postId,
      });
    } catch (error) {
      // The database write has not started; a new path avoids partial uploads.
      attempt.id = randomUUID();
      throw error;
    }
  }
  attempt.uploadedPaths = uploadedPaths;
  const wasUncertain = Boolean(attempt.outcomeUncertain);
  attempt.outcomeUncertain = true;
  return runApiRequest(async (signal) => {
    const { data, error, status } = await supabase
      .rpc("create_post_idempotent", {
        p_operation_id: postId,
        p_post_id: postId,
        p_kind: input.kind,
        p_body: input.body?.trim() || undefined,
        p_media_paths: uploadedPaths,
        p_forum_id: input.forumId,
        p_entity_id: input.entityId,
        p_score: input.score,
      })
      .abortSignal(signal)
      .single();
    if (error) {
      if (
        !wasUncertain &&
        typeof error.code === "string" &&
        /^(22|23|28|42)[0-9A-Z]{3}$/.test(error.code)
      )
        attempt.outcomeUncertain = false;
      throw normalizeApiError(
        error,
        input.kind === "GLOBAL_SHARE"
          ? API_ERROR_MESSAGES.PUBLISH_YOUR_RATING
          : API_ERROR_MESSAGES.PUBLISH_THIS_FORUM_POST,
        status,
      );
    }
    attempt.outcomeUncertain = false;
    return data;
  });
}

export function lookupAskCreation(
  operationId: string,
  requestSignal?: AbortSignal,
): Promise<AskCreationLookup> {
  return runApiRequest(
    async (signal) => {
      const { data, error, status } = await supabase
        .rpc("lookup_ask_creation", { p_operation_id: operationId })
        .abortSignal(signal)
        .maybeSingle();
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.CHECK_ASK_CREATION,
        status,
      );
      return data
        ? { status: "confirmed", post: data }
        : { status: "inconclusive" };
    },
    {
      message: API_ERROR_MESSAGES.CHECK_ASK_CREATION,
      retries: 1,
      signal: requestSignal,
    },
  );
}

export type CreateForumAskPostInput = CreateAskPostInput & {
  attempt: AskCreationAttempt;
  forumId: string;
};

export type CreateForumSharePostInput = {
  authorId: string;
  attempt: AskCreationAttempt;
  body?: string;
  entityId: string;
  forumId: string;
  images: AskImageUpload[];
  score: number;
};

export async function createForumAskPost(
  input: CreateForumAskPostInput,
): Promise<Post> {
  validateAskPost(input);
  validateForumPost({ ...input, postType: "ASK" });
  return createIdempotentPost({ ...input, kind: "FORUM_ASK" });
}

export async function createForumSharePost(
  input: CreateForumSharePostInput,
): Promise<Post> {
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    throw validationError(API_ERROR_MESSAGES.CHOOSE_A_RATING_FROM_1_TO_5, {
      score: API_ERROR_MESSAGES.CHOOSE_A_RATING_FROM_1_TO_5,
    });
  }
  if (input.images.length > 3) {
    throw validationError(
      API_ERROR_MESSAGES.A_RATING_CAN_CONTAIN_UP_TO_THREE_IMAGES,
      {
        images: API_ERROR_MESSAGES.A_RATING_CAN_CONTAIN_UP_TO_THREE_IMAGES,
      },
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
  validateForumPost({ ...input, postType: "SHARE" });
  return createIdempotentPost({ ...input, kind: "FORUM_SHARE" });
}

export async function createAskPost(
  input: CreateAskPostInput & { attempt?: AskCreationAttempt },
): Promise<Post> {
  validateAskPost(input);

  const attempt = input.attempt ?? { id: randomUUID() };
  const postId = attempt.id;
  let uploadedPaths = attempt.uploadedPaths;
  if (!uploadedPaths) {
    try {
      uploadedPaths = await uploadPostImages({
        authorId: input.authorId,
        images: input.images,
        postId,
      });
    } catch (error) {
      // No database request has started for this upload attempt.
      attempt.id = randomUUID();
      throw error;
    }
  }
  attempt.uploadedPaths = uploadedPaths;

  // Uploaded objects are retained if the database outcome is uncertain.
  const wasUncertain = Boolean(attempt.outcomeUncertain);
  attempt.outcomeUncertain = true;
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .rpc("create_ask_post_idempotent", {
        p_body: input.body?.trim() ?? "",
        p_media_paths: uploadedPaths,
        p_operation_id: postId,
        p_post_id: postId,
      })
      .abortSignal(signal)
      .single();

    if (error) {
      // These PostgreSQL errors mean the statement was rejected and rolled back.
      if (
        !wasUncertain &&
        typeof error.code === "string" &&
        /^(22|23|28|42)[0-9A-Z]{3}$/.test(error.code)
      ) {
        attempt.outcomeUncertain = false;
      }
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.CREATE_YOUR_ASK_POST,
        errorResponseStatus,
      );
    }

    attempt.outcomeUncertain = false;
    return data;
  });
}

export async function uploadPostImages({
  authorId,
  images,
  postId,
  signal,
}: {
  authorId: string;
  images: AskImageUpload[];
  postId: string;
  signal?: AbortSignal;
}) {
  const uploadedPaths: string[] = [];

  try {
    for (const [index, image] of images.entries()) {
      signal?.throwIfAborted();
      const storagePath = `${authorId}/${postId}/${index + 1}.${image.extension}`;
      const { error } = await runApiRequest(() =>
        supabase.storage
          .from(POST_IMAGES_BUCKET)
          .upload(storagePath, image.data, {
            cacheControl: "31536000",
            contentType: image.contentType,
            upsert: false,
          }),
      );

      throwIfStorageError(
        error,
        API_ERROR_MESSAGES.AN_IMAGE_COULD_NOT_BE_UPLOADED,
      );
      uploadedPaths.push(storagePath);
    }

    return uploadedPaths;
  } catch (error) {
    await tryRemovePostImages(uploadedPaths);
    throw error;
  }
}

export async function removePostImages(storagePaths: string[]) {
  if (storagePaths.length === 0) return;
  const { error } = await supabase.storage
    .from(POST_IMAGES_BUCKET)
    .remove(storagePaths);
  throwIfStorageError(error, API_ERROR_MESSAGES.CLEAN_UP_POST_IMAGES);
}

export function getPost(
  postId: string,
  requestSignal?: AbortSignal,
): Promise<PostWithDetails | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("posts")
        .select(POST_DETAILS_SELECT)
        .eq("id", postId)
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_THIS_POST,
        errorResponseStatus,
      );

      if (!data) return null;

      const [post] = await signPostMedia([data]);
      return post;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getGlobalPostsByIds(
  postIds: string[],
  requestSignal?: AbortSignal,
): Promise<PostWithDetails[]> {
  if (postIds.length === 0) return Promise.resolve([]);

  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("posts")
        .select(POST_DETAILS_SELECT)
        .in("id", postIds)
        .is("forum_id", null)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_FEED_POSTS,
        errorResponseStatus,
      );

      const byId = new Map(
        (await signPostMedia(data)).map((post) => [post.id, post]),
      );
      const orderedPosts = postIds.flatMap((postId) => {
        const post = byId.get(postId);
        return post ? [post] : [];
      });
      return attachEngagement(orderedPosts, requestSignal);
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getAskPostsByAuthor(
  authorId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<PostPage> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("posts")
        .select(POST_DETAILS_SELECT)
        .eq("author_id", authorId)
        .eq("post_type", "ASK")
        .is("forum_id", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + POST_PAGE_SIZE)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_ASK_POSTS,
        errorResponseStatus,
      );

      const hasNextPage = data.length > POST_PAGE_SIZE;
      const items = await attachEngagement(
        await signPostMedia(data.slice(0, POST_PAGE_SIZE)),
        requestSignal,
      );

      return {
        items,
        nextOffset: hasNextPage ? offset + POST_PAGE_SIZE : undefined,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getForumPosts(
  forumId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<PostPage> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("posts")
        .select(POST_DETAILS_SELECT)
        .eq("forum_id", forumId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + POST_PAGE_SIZE)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_FORUM_POSTS,
        errorResponseStatus,
      );

      const hasNextPage = data.length > POST_PAGE_SIZE;
      let items = await signPostMedia(data.slice(0, POST_PAGE_SIZE));
      items = await attachEngagement(items, requestSignal);

      const sharePosts = items.filter(
        (post) => post.post_type === "SHARE" && post.entity_id,
      );
      if (sharePosts.length) {
        const [entities, ratings] = await Promise.all([
          getEntitiesByIds(
            sharePosts.map((post) => post.entity_id as string),
            requestSignal,
          ),
          runApiRequest(
            async (batchSignal) => {
              const { data, error, status } = await supabase
                .from("forum_share_ratings")
                .select("post_id, score")
                .in(
                  "post_id",
                  sharePosts.map((post) => post.id),
                )
                .abortSignal(batchSignal);
              throwIfSupabaseError(
                error,
                API_ERROR_MESSAGES.LOAD_SHARE_RATINGS,
                status,
              );
              return data;
            },
            { retries: 1, signal: requestSignal },
          ),
        ]);
        const entityById = new Map(
          entities.map((entity) => [entity.id, entity]),
        );
        const scoreByPostId = new Map(
          ratings.map((rating) => [rating.post_id, rating.score]),
        );
        items = items.map((post) => {
          if (post.post_type !== "SHARE" || !post.entity_id) return post;
          const entity = entityById.get(post.entity_id);
          const ratingScore = scoreByPostId.get(post.id);
          if (!entity || ratingScore === undefined) {
            throw normalizeApiError(
              undefined,
              API_ERROR_MESSAGES.LOAD_FORUM_POSTS,
            );
          }
          return { ...post, forumShare: { entity, ratingScore } };
        });
      }

      return {
        items,
        nextOffset: hasNextPage ? offset + POST_PAGE_SIZE : undefined,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

async function attachEngagement(
  posts: PostWithDetails[],
  requestSignal?: AbortSignal,
): Promise<PostWithDetails[]> {
  if (!posts.length) return posts;
  const summaries = await runApiRequest(
    async (signal) => {
      const { data, error, status } = await supabase
        .rpc("get_post_list_engagement", {
          p_post_ids: posts.map((post) => post.id),
        })
        .abortSignal(signal);
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_POST_ENGAGEMENT,
        status,
      );
      return data;
    },
    { retries: 1, signal: requestSignal },
  );
  const summaryByPostId = new Map(
    summaries.map((summary) => [
      summary.post_id,
      {
        averageScore: summary.average_score,
        commentCount: summary.comment_count,
        ratingCount: summary.rating_count,
      },
    ]),
  );
  return posts.map((post) => ({
    ...post,
    engagement: summaryByPostId.get(post.id) ?? {
      averageScore: null,
      commentCount: 0,
      ratingCount: 0,
    },
  }));
}

export function getSharePostsByEntity(
  entityId: string,
  offset = 0,
  requestSignal?: AbortSignal,
): Promise<PostPage> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("posts")
        .select(POST_DETAILS_SELECT)
        .eq("entity_id", entityId)
        .eq("post_type", "SHARE")
        .is("forum_id", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + POST_PAGE_SIZE)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_SHARE_RATINGS,
        errorResponseStatus,
      );

      const hasNextPage = data.length > POST_PAGE_SIZE;
      const items = await signPostMedia(data.slice(0, POST_PAGE_SIZE));

      return {
        items,
        nextOffset: hasNextPage ? offset + POST_PAGE_SIZE : undefined,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export async function updateAskPost(
  postId: string,
  input: UpdateAskPostInput,
): Promise<Post> {
  const body = input.body?.trim() || null;

  if ((body?.length ?? 0) > 2000) {
    throw validationError(
      API_ERROR_MESSAGES.THE_DESCRIPTION_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      {
        body: API_ERROR_MESSAGES.THE_DESCRIPTION_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      },
    );
  }
  if (!body) {
    throw validationError(API_ERROR_MESSAGES.ADD_YOUR_QUESTION_BEFORE_SAVING, {
      body: API_ERROR_MESSAGES.ADD_YOUR_QUESTION_BEFORE_SAVING,
    });
  }

  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("posts")
      .update({ body })
      .eq("id", postId)
      .eq("post_type", "ASK")
      .select(
        "id, author_id, post_type, entity_id, forum_id, body, created_at, updated_at",
      )
      .abortSignal(signal)
      .single();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.UPDATE_THIS_ASK_POST,
      errorResponseStatus,
    );

    return data;
  });
}

export function deletePost(postId: string): Promise<void> {
  return runApiRequest(async (signal) => {
    const { data, error, status } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .select("id")
      .abortSignal(signal)
      .maybeSingle();
    throwIfSupabaseError(error, API_ERROR_MESSAGES.DELETE_THIS_POST, status);
    if (!data)
      throw normalizeApiError(undefined, API_ERROR_MESSAGES.DELETE_THIS_POST);
    // The database trigger queues deleted media for trusted Storage cleanup.
  });
}

async function signPostMedia(
  posts: RawPostWithDetails[],
): Promise<PostWithDetails[]> {
  const storagePaths = posts.flatMap((post) =>
    post.media.map(({ storage_path }) => storage_path),
  );

  if (storagePaths.length === 0) {
    return posts.map((post) => ({ ...post, media: [] }));
  }

  const { data, error } = await supabase.storage
    .from(POST_IMAGES_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

  throwIfStorageError(error, API_ERROR_MESSAGES.LOAD_POST_IMAGES);

  const signedUrls = new Map(
    data.map(({ path, signedUrl, error: signedUrlError }) => {
      if (!path || !signedUrl || signedUrlError) {
        throw normalizeStorageError(
          signedUrlError,
          API_ERROR_MESSAGES.LOAD_POST_IMAGES,
        );
      }

      return [path, signedUrl] as const;
    }),
  );

  return posts.map((post) => ({
    ...post,
    media: [...post.media]
      .sort((first, second) => first.position - second.position)
      .map((media) => {
        const signedUrl = signedUrls.get(media.storage_path);

        if (!signedUrl) {
          throw normalizeApiError(
            undefined,
            API_ERROR_MESSAGES.LOAD_POST_IMAGES,
          );
        }

        return { ...media, signedUrl };
      }),
  }));
}

function validateAskPost(input: CreateAskPostInput) {
  const bodyLength = input.body?.trim().length ?? 0;

  if (!input.authorId) {
    throw unauthenticatedError(
      API_ERROR_MESSAGES.YOU_MUST_BE_SIGNED_IN_TO_CREATE_A_POST,
    );
  }

  if (bodyLength > 2000) {
    throw validationError(
      API_ERROR_MESSAGES.THE_DESCRIPTION_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      {
        body: API_ERROR_MESSAGES.THE_DESCRIPTION_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      },
    );
  }
  if (bodyLength < 1) {
    throw validationError(
      API_ERROR_MESSAGES.ADD_YOUR_QUESTION_BEFORE_PUBLISHING,
      { body: API_ERROR_MESSAGES.ADD_YOUR_QUESTION_BEFORE_PUBLISHING },
    );
  }

  if (input.images.length > 3) {
    throw validationError(
      API_ERROR_MESSAGES.AN_ASK_POST_CAN_CONTAIN_UP_TO_THREE_IMAGES,
      { images: API_ERROR_MESSAGES.AN_ASK_POST_CAN_CONTAIN_UP_TO_THREE_IMAGES },
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

function validateForumPost({
  authorId,
  body,
  entityId,
  postType,
}: {
  authorId: string;
  body?: string;
  entityId?: string;
  postType: "ASK" | "SHARE";
}) {
  if (!authorId) {
    throw unauthenticatedError(
      API_ERROR_MESSAGES.YOU_MUST_BE_SIGNED_IN_TO_PUBLISH_A_FORUM_POST,
    );
  }
  if ((body?.trim().length ?? 0) > 2_000) {
    throw validationError(
      API_ERROR_MESSAGES.THE_DESCRIPTION_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      {
        body: API_ERROR_MESSAGES.THE_DESCRIPTION_MUST_BE_2_000_CHARACTERS_OR_FEWER,
      },
    );
  }
  if (postType === "ASK") {
    if (!body?.trim()) {
      throw validationError(
        API_ERROR_MESSAGES.ADD_YOUR_QUESTION_BEFORE_PUBLISHING,
        { body: API_ERROR_MESSAGES.ADD_YOUR_QUESTION_BEFORE_PUBLISHING },
      );
    }
    if (entityId) {
      throw validationError(
        API_ERROR_MESSAGES.AN_ASK_POST_CANNOT_INCLUDE_A_FIND,
        { entityId: API_ERROR_MESSAGES.AN_ASK_POST_CANNOT_INCLUDE_A_FIND },
      );
    }
  } else if (!entityId) {
    throw validationError(API_ERROR_MESSAGES.CHOOSE_A_FIND_TO_SHARE, {
      entityId: API_ERROR_MESSAGES.CHOOSE_A_FIND_TO_SHARE,
    });
  }
}

export async function tryRemovePostImages(storagePaths: string[]) {
  try {
    await removePostImages(storagePaths);
  } catch {
    // Preserve the original error; unregistered uploads may require cleanup.
  }
}
