import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import {
  isDefiniteCreationRejection,
  type ResourceCreationAttempt,
  rotateResourceAttempt,
} from "./creation-recovery";

import {
  API_ERROR_MESSAGES,
  normalizeApiError,
  normalizeStorageError,
} from "./errors";
import type { AskImageUpload } from "./posts";
import { runApiRequest } from "./request";
import { throwIfStorageError, throwIfSupabaseError } from "./supabase-errors";

export type Forum = Tables<"forums">;

export type ForumSummary = Forum & {
  coverImageUrl: string | null;
  imageUrl: string | null;
  isMember: boolean;
  memberCount: number;
};

export type ForumDetail = ForumSummary & {
  isMember: boolean;
};

export function deleteForum(forumId: string): Promise<void> {
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("forums")
      .delete()
      .eq("id", forumId)
      .select("id")
      .abortSignal(signal)
      .maybeSingle();
    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.DELETE_THIS_FORUM,
      errorResponseStatus,
    );
    if (!data)
      throw normalizeApiError(undefined, API_ERROR_MESSAGES.DELETE_THIS_FORUM);
  });
}

export type CreateForumInput = Pick<
  Forum,
  "description" | "name" | "rules" | "slug"
> & { ownerId: string };

export async function createForum(
  input: CreateForumInput & {
    attempt: ResourceCreationAttempt;
    forumImage?: AskImageUpload;
    coverImage?: AskImageUpload;
  },
): Promise<Forum> {
  const forumId = input.attempt.id;
  const imagePath = input.forumImage
    ? `${input.ownerId}/${forumId}/image.${input.forumImage.extension}`
    : undefined;
  const coverPath = input.coverImage
    ? `${input.ownerId}/${forumId}/cover.${input.coverImage.extension}`
    : undefined;
  if (!input.attempt.uploadedPaths)
    try {
      for (const [image, path, message] of [
        [input.forumImage, imagePath, API_ERROR_MESSAGES.UPLOAD_FORUM_IMAGE],
        [input.coverImage, coverPath, API_ERROR_MESSAGES.UPLOAD_FORUM_COVER],
      ] as const) {
        if (!image || !path) continue;
        const { error: uploadError } = await runApiRequest(() =>
          supabase.storage.from("forum-images").upload(path, image.data, {
            contentType: image.contentType,
            upsert: false,
          }),
        );
        if (uploadError) {
          throwIfStorageError(uploadError, message);
        }
      }

      input.attempt.uploadedPaths = { image: imagePath, cover: coverPath };
    } catch (cause) {
      // The database write has not started. A new path avoids partial uploads.
      rotateResourceAttempt(input.attempt);
      throw cause;
    }
  const paths = input.attempt.uploadedPaths;
  const wasUncertain = Boolean(input.attempt.outcomeUncertain);
  input.attempt.outcomeUncertain = true;
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .rpc("create_forum_idempotent", {
        p_operation_id: forumId,
        p_forum_id: forumId,
        p_image_path: paths.image,
        p_cover_image_path: paths.cover,
        p_description: input.description?.trim() || undefined,
        p_name: input.name.trim(),
        p_rules: input.rules.trim(),
        p_slug: input.slug.trim(),
      })
      .abortSignal(signal)
      .single();

    if (error) {
      if (isDefiniteCreationRejection(error, wasUncertain))
        input.attempt.outcomeUncertain = false;
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.CREATE_THIS_FORUM,
        errorResponseStatus,
      );
    }
    input.attempt.outcomeUncertain = false;
    return data;
  });
}

export function getForums(
  requestSignal?: AbortSignal,
): Promise<ForumSummary[]> {
  return runApiRequest(
    async (signal) => {
      const {
        data: forums,
        error: forumsError,
        status: forumsErrorResponseStatus,
      } = await supabase.rpc("get_forum_summaries", {}).abortSignal(signal);

      throwIfSupabaseError(
        forumsError,
        API_ERROR_MESSAGES.LOAD_FORUMS,
        forumsErrorResponseStatus,
      );

      const summaries = forums.map((forum) => ({
        cover_image_path: forum.cover_image_path,
        created_at: forum.created_at,
        description: forum.description,
        id: forum.id,
        image_path: forum.image_path,
        isMember: forum.is_member,
        memberCount: forum.member_count,
        name: forum.name,
        owner_id: forum.owner_id,
        rules: forum.rules,
        slug: forum.slug,
        updated_at: forum.updated_at,
      }));

      return signForumImages(summaries);
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getForum(
  forumId: string,
  requestSignal?: AbortSignal,
): Promise<ForumDetail | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data: forum,
        error: forumError,
        status: forumErrorResponseStatus,
      } = await supabase
        .rpc("get_forum_summaries", { p_forum_id: forumId })
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        forumError,
        API_ERROR_MESSAGES.LOAD_THIS_FORUM,
        forumErrorResponseStatus,
      );

      if (!forum) return null;

      const [detail] = await signForumImages([
        {
          cover_image_path: forum.cover_image_path,
          created_at: forum.created_at,
          description: forum.description,
          id: forum.id,
          image_path: forum.image_path,
          isMember: forum.is_member,
          memberCount: forum.member_count,
          name: forum.name,
          owner_id: forum.owner_id,
          rules: forum.rules,
          slug: forum.slug,
          updated_at: forum.updated_at,
        },
      ]);
      return detail;
    },
    { retries: 1, signal: requestSignal },
  );
}

async function signForumImages<T extends Forum>(
  forums: T[],
): Promise<
  Array<T & { coverImageUrl: string | null; imageUrl: string | null }>
> {
  const paths = forums.flatMap((forum) => [
    ...(forum.image_path ? [forum.image_path] : []),
    ...(forum.cover_image_path ? [forum.cover_image_path] : []),
  ]);
  if (paths.length === 0) {
    return forums.map((forum) => ({
      ...forum,
      coverImageUrl: null,
      imageUrl: null,
    }));
  }

  const { data, error } = await runApiRequest(() =>
    supabase.storage.from("forum-images").createSignedUrls(paths, 60 * 60),
  );
  throwIfStorageError(error, API_ERROR_MESSAGES.LOAD_FORUM_IMAGES);

  const urls = new Map(
    data.map(({ path, signedUrl, error: signedUrlError }) => {
      if (!path || !signedUrl || signedUrlError) {
        throw normalizeStorageError(
          signedUrlError,
          API_ERROR_MESSAGES.LOAD_FORUM_IMAGES,
        );
      }
      return [path, signedUrl] as const;
    }),
  );
  if (paths.some((path) => !urls.has(path))) {
    throw normalizeApiError(undefined, API_ERROR_MESSAGES.LOAD_FORUM_IMAGES);
  }
  return forums.map((forum) => ({
    ...forum,
    coverImageUrl: forum.cover_image_path
      ? (urls.get(forum.cover_image_path) ?? null)
      : null,
    imageUrl: forum.image_path ? (urls.get(forum.image_path) ?? null) : null,
  }));
}

export function joinForum(forumId: string, userId: string): Promise<void> {
  return runApiRequest(async (signal) => {
    const { error, status: errorResponseStatus } = await supabase
      .from("forum_memberships")
      .insert({ forum_id: forumId, user_id: userId })
      .abortSignal(signal);

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.JOIN_THIS_FORUM,
      errorResponseStatus,
    );
  });
}

export function leaveForum(forumId: string, userId: string): Promise<void> {
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("forum_memberships")
      .delete()
      .eq("forum_id", forumId)
      .eq("user_id", userId)
      .select("forum_id")
      .abortSignal(signal)
      .maybeSingle();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.LEAVE_THIS_FORUM,
      errorResponseStatus,
    );
    if (!data)
      throw normalizeApiError(undefined, API_ERROR_MESSAGES.LEAVE_THIS_FORUM);
  });
}
