import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import {
  API_ERROR_MESSAGES,
  normalizeApiError,
  validationError,
} from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

const COMMENT_PAGE_SIZE = 10;
const COMMENT_SELECT =
  "id, post_id, author_id, parent_id, body, created_at, updated_at, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)" as const;

export type Comment = Tables<"comments">;
export type CommentAuthor = Pick<
  Tables<"profiles">,
  "avatar_url" | "display_name" | "id" | "username"
>;
export type CommentWithAuthor = Comment & { author: CommentAuthor };
export type CommentThread = CommentWithAuthor & {
  replies: CommentWithAuthor[];
};
export type CommentPage = {
  items: CommentThread[];
  nextOffset?: number;
  totalCount: number;
};
export function getCommentCount(
  postId: string,
  requestSignal?: AbortSignal,
): Promise<number> {
  return runApiRequest(
    async (signal) => {
      const {
        count,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .abortSignal(signal);

      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_THE_COMMENT_COUNT,
        errorResponseStatus,
      );

      if (count === null) {
        throw normalizeApiError(
          undefined,
          API_ERROR_MESSAGES.LOAD_THE_COMMENT_COUNT,
        );
      }
      return count;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getTopLevelComments(
  postId: string,
  offset = 0,
  pageSize = COMMENT_PAGE_SIZE,
  requestSignal?: AbortSignal,
): Promise<CommentPage> {
  return runApiRequest(
    async (signal) => {
      const [topLevelResult, countResult] = await Promise.all([
        supabase
          .from("comments")
          .select(COMMENT_SELECT)
          .eq("post_id", postId)
          .is("parent_id", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + pageSize)
          .abortSignal(signal),
        supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .eq("post_id", postId)
          .abortSignal(signal),
      ]);

      throwIfSupabaseError(
        topLevelResult.error,
        API_ERROR_MESSAGES.LOAD_THE_COMMENTS,
        topLevelResult.status,
      );

      throwIfSupabaseError(
        countResult.error,
        API_ERROR_MESSAGES.LOAD_THE_COMMENT_COUNT,
        countResult.status,
      );

      if (countResult.count === null) {
        throw normalizeApiError(
          undefined,
          API_ERROR_MESSAGES.LOAD_THE_COMMENT_COUNT,
        );
      }

      const hasNextPage = topLevelResult.data.length > pageSize;
      const topLevelComments = topLevelResult.data.slice(0, pageSize);
      const parentIds = topLevelComments.map((comment) => comment.id);
      let replies: CommentWithAuthor[] = [];

      if (parentIds.length > 0) {
        const {
          data,
          error,
          status: errorResponseStatus,
        } = await supabase
          .from("comments")
          .select(COMMENT_SELECT)
          .in("parent_id", parentIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .abortSignal(signal);

        throwIfSupabaseError(
          error,
          API_ERROR_MESSAGES.LOAD_THE_REPLIES,
          errorResponseStatus,
        );

        replies = data;
      }

      return {
        items: topLevelComments.map((comment) => ({
          ...comment,
          replies: replies.filter((reply) => reply.parent_id === comment.id),
        })),
        nextOffset: hasNextPage ? offset + pageSize : undefined,
        totalCount: countResult.count,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export function createTopLevelComment(input: {
  authorId: string;
  body: string;
  postId: string;
}): Promise<CommentWithAuthor> {
  return createComment(input);
}

export function createReply(input: {
  authorId: string;
  body: string;
  parentId: string;
  postId: string;
}): Promise<CommentWithAuthor> {
  return createComment(input);
}

async function createComment(input: {
  authorId: string;
  body: string;
  parentId?: string;
  postId: string;
}): Promise<CommentWithAuthor> {
  const body = validateCommentBody(input.body);

  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("comments")
      .insert({
        author_id: input.authorId,
        body,
        parent_id: input.parentId ?? null,
        post_id: input.postId,
      })
      .select(COMMENT_SELECT)
      .abortSignal(signal)
      .single();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.POST_YOUR_COMMENT,
      errorResponseStatus,
    );

    return data;
  });
}

export async function updateComment(
  commentId: string,
  bodyInput: string,
): Promise<CommentWithAuthor> {
  const body = validateCommentBody(bodyInput);

  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("comments")
      .update({ body })
      .eq("id", commentId)
      .select(COMMENT_SELECT)
      .abortSignal(signal)
      .single();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.UPDATE_YOUR_COMMENT,
      errorResponseStatus,
    );

    return data;
  });
}

export function deleteComment(commentId: string): Promise<void> {
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .select("id")
      .abortSignal(signal)
      .maybeSingle();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.DELETE_YOUR_COMMENT,
      errorResponseStatus,
    );
    if (!data)
      throw normalizeApiError(
        undefined,
        API_ERROR_MESSAGES.DELETE_YOUR_COMMENT,
      );
  });
}

function validateCommentBody(bodyInput: string) {
  const body = bodyInput.trim();

  if (body.length < 1 || body.length > 2000) {
    throw validationError(
      API_ERROR_MESSAGES.A_COMMENT_MUST_BE_BETWEEN_1_AND_2_000_CHARACTERS,
      {
        body: API_ERROR_MESSAGES.A_COMMENT_MUST_BE_BETWEEN_1_AND_2_000_CHARACTERS,
      },
    );
  }

  return body;
}
