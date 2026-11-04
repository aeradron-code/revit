import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import type { Entity } from "./entities";
import {
  API_ERROR_MESSAGES,
  normalizeApiError,
  validationError,
} from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";

export type PersonalPick = Tables<"picks">;

export type PersonalPickItem = Pick<
  Tables<"pick_items">,
  "created_at" | "entity_id" | "note" | "pick_id" | "position"
> & {
  entity: Entity;
};

export type PersonalPickDetail = PersonalPick & {
  items: PersonalPickItem[];
};

export type SavePersonalPickInput = {
  description?: string;
  items: Array<{
    entityId: string;
    note?: string;
  }>;
  title: string;
};

export function createPersonalPick(
  input: SavePersonalPickInput,
): Promise<PersonalPick> {
  return savePersonalPick("create_personal_pick", input);
}

export function updatePersonalPick(
  pickId: string,
  input: SavePersonalPickInput,
): Promise<PersonalPick> {
  return savePersonalPick("update_personal_pick", input, pickId);
}

export function deletePersonalPick(pickId: string): Promise<void> {
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("picks")
      .delete()
      .eq("id", pickId)
      .select("id")
      .abortSignal(signal)
      .maybeSingle();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.DELETE_THIS_PICK,
      errorResponseStatus,
    );
    if (!data)
      throw normalizeApiError(undefined, API_ERROR_MESSAGES.DELETE_THIS_PICK);
  });
}

export function getPersonalPick(
  pickId: string,
  requestSignal?: AbortSignal,
): Promise<PersonalPickDetail | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data: pick,
        error: pickError,
        status: pickErrorResponseStatus,
      } = await supabase
        .from("picks")
        .select(
          "id, author_id, pick_type, title, description, created_at, updated_at",
        )
        .eq("id", pickId)
        .eq("pick_type", "PERSONAL")
        .abortSignal(signal)
        .maybeSingle();

      throwIfSupabaseError(
        pickError,
        API_ERROR_MESSAGES.LOAD_THIS_PICK,
        pickErrorResponseStatus,
      );

      if (!pick) return null;

      const {
        data: items,
        error: itemsError,
        status: itemsErrorResponseStatus,
      } = await supabase
        .from("pick_items")
        .select(
          "pick_id, entity_id, position, note, created_at, entity:entities!pick_items_entity_id_fkey(id, created_by, category_id, name, description, image_url, address_line_1, address_line_2, locality, district, state, country, postal_code, category:entity_categories!inner(id, slug, label))",
        )
        .eq("pick_id", pick.id)
        .order("position", { ascending: true })
        .abortSignal(signal);

      throwIfSupabaseError(
        itemsError,
        API_ERROR_MESSAGES.LOAD_THE_FINDS_IN_THIS_PICK,
        itemsErrorResponseStatus,
      );

      return {
        ...pick,
        items,
      };
    },
    { retries: 1, signal: requestSignal },
  );
}

export type PickPreview = {
  entity_id: string;
  image_url: string;
};

export type PickDirectoryItem = PersonalPick & {
  author: import("./follows").FollowProfile;
  imagePreviews: PickPreview[];
  isFollowed: boolean;
};

export function getPersonalPicksByAuthor(
  authorId: string,
  requestSignal?: AbortSignal,
): Promise<PickDirectoryItem[]> {
  return runApiRequest(
    async (signal) => {
      const items: PickDirectoryItem[] = [];
      let cursor: { updatedAt: string; id: string } | undefined;

      for (;;) {
        const { data, error, status } = await supabase
          .rpc("get_picks_directory", {
            p_scope: "own",
            p_limit: 50,
            p_before_updated_at: cursor?.updatedAt,
            p_before_id: cursor?.id,
          })
          .abortSignal(signal);

        throwIfSupabaseError(error, API_ERROR_MESSAGES.LOAD_PICKS, status);

        for (const pick of data) {
          const author = pick.author;
          if (
            pick.author_id !== authorId ||
            !author ||
            typeof author !== "object" ||
            Array.isArray(author) ||
            typeof author.id !== "string"
          ) {
            throw normalizeApiError(
              new Error("Invalid Pick directory row"),
              API_ERROR_MESSAGES.LOAD_PICKS,
            );
          }

          items.push({
            id: pick.id,
            author_id: pick.author_id,
            pick_type: pick.pick_type,
            title: pick.title,
            description: pick.description,
            created_at: pick.created_at,
            updated_at: pick.updated_at,
            author: {
              id: author.id,
              username:
                typeof author.username === "string" ? author.username : null,
              display_name:
                typeof author.display_name === "string"
                  ? author.display_name
                  : null,
              avatar_url:
                typeof author.avatar_url === "string"
                  ? author.avatar_url
                  : null,
              bio: typeof author.bio === "string" ? author.bio : null,
            },
            imagePreviews: parsePickPreviews(pick.image_previews),
            isFollowed: pick.is_followed,
          });
        }

        if (data.length < 50) return items;
        const last = data[data.length - 1];
        cursor = { updatedAt: last.updated_at, id: last.id };
      }
    },
    { retries: 1, signal: requestSignal },
  );
}

async function savePersonalPick(
  operation: "create_personal_pick" | "update_personal_pick",
  input: SavePersonalPickInput,
  pickId?: string,
): Promise<PersonalPick> {
  const title = input.title.trim();
  const targetPickId = pickId ?? "";

  if (!title) {
    throw validationError(API_ERROR_MESSAGES.GIVE_YOUR_PICK_A_TITLE, {
      title: API_ERROR_MESSAGES.GIVE_YOUR_PICK_A_TITLE,
    });
  }

  if (input.items.length === 0) {
    throw validationError(
      API_ERROR_MESSAGES.ADD_AT_LEAST_ONE_FIND_TO_YOUR_PICK,
      { items: API_ERROR_MESSAGES.ADD_AT_LEAST_ONE_FIND_TO_YOUR_PICK },
    );
  }

  if (operation === "update_personal_pick" && !targetPickId) {
    throw validationError(API_ERROR_MESSAGES.CHOOSE_A_PICK_TO_UPDATE, {
      pickId: API_ERROR_MESSAGES.CHOOSE_A_PICK_TO_UPDATE,
    });
  }

  return runApiRequest(async (signal) => {
    const payload = {
      p_description: input.description?.trim() || undefined,
      p_items: input.items.map((item, index) => ({
        entity_id: item.entityId,
        note: item.note?.trim() || undefined,
        position: index + 1,
      })),
      p_title: title,
    };
    const request =
      operation === "create_personal_pick"
        ? supabase.rpc("create_personal_pick", payload)
        : supabase.rpc("update_personal_pick", {
            ...payload,
            p_pick_id: targetPickId,
          });
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await request.abortSignal(signal).single();

    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.SAVE_THIS_PICK,
      errorResponseStatus,
    );

    return data;
  });
}

export async function getPicksFromFollowing(
  _userId: string,
  requestSignal?: AbortSignal,
): Promise<PickDirectoryItem[]> {
  const items: PickDirectoryItem[] = [];
  let cursor: { updatedAt: string; id: string } | undefined;
  for (;;) {
    const page = await runApiRequest(
      async (signal) => {
        const { data, error, status } = await supabase
          .rpc("get_picks_directory", {
            p_scope: "following",
            p_limit: 50,
            p_before_updated_at: cursor?.updatedAt,
            p_before_id: cursor?.id,
          })
          .abortSignal(signal);
        throwIfSupabaseError(error, API_ERROR_MESSAGES.LOAD_PICKS, status);
        return data;
      },
      {
        retries: 1,
        message: API_ERROR_MESSAGES.LOAD_PICKS,
        signal: requestSignal,
      },
    );
    for (const pick of page) {
      const author = pick.author;
      if (
        !author ||
        typeof author !== "object" ||
        Array.isArray(author) ||
        typeof author.id !== "string" ||
        (author.username !== null && typeof author.username !== "string") ||
        (author.display_name !== null &&
          typeof author.display_name !== "string") ||
        (author.avatar_url !== null && typeof author.avatar_url !== "string") ||
        (author.bio !== null && typeof author.bio !== "string")
      ) {
        throw normalizeApiError(
          new Error("Invalid Pick author"),
          API_ERROR_MESSAGES.LOAD_PICKS,
        );
      }
      items.push({
        id: pick.id,
        author_id: pick.author_id,
        pick_type: pick.pick_type,
        title: pick.title,
        description: pick.description,
        created_at: pick.created_at,
        updated_at: pick.updated_at,
        author: {
          id: author.id,
          username: author.username,
          display_name: author.display_name,
          avatar_url: author.avatar_url,
          bio: author.bio,
        },
        imagePreviews: parsePickPreviews(pick.image_previews),
        isFollowed: pick.is_followed,
      });
    }
    if (page.length < 50) return items;
    const last = page[page.length - 1];
    cursor = { updatedAt: last.updated_at, id: last.id };
  }
}

function parsePickPreviews(value: unknown): PickPreview[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const preview = item as Record<string, unknown>;
    return typeof preview.entity_id === "string" &&
      typeof preview.image_url === "string"
      ? [{ entity_id: preview.entity_id, image_url: preview.image_url }]
      : [];
  });
}

export async function getFollowedPickIds(
  userId: string,
  requestSignal?: AbortSignal,
): Promise<string[]> {
  return runApiRequest(
    async (signal) => {
      const ids: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const {
          data,
          error,
          status: errorResponseStatus,
        } = await supabase
          .from("pick_follows")
          .select("pick_id")
          .eq("user_id", userId)
          .order("pick_id", { ascending: true })
          .range(offset, offset + 999)
          .abortSignal(signal);
        throwIfSupabaseError(
          error,
          API_ERROR_MESSAGES.LOAD_FOLLOWED_PICKS,
          errorResponseStatus,
        );
        ids.push(...data.map((item) => item.pick_id));
        if (data.length < 1000) return ids;
      }
    },
    { retries: 1, signal: requestSignal },
  );
}

export async function setPickFollow(
  userId: string,
  pickId: string,
  follow: boolean,
): Promise<void> {
  return runApiRequest(async (signal) => {
    // Unfollow is idempotent; zero rows, including RLS-filtered rows, are not distinguished.
    const request = follow
      ? supabase
          .from("pick_follows")
          .insert({ user_id: userId, pick_id: pickId })
      : supabase
          .from("pick_follows")
          .delete()
          .eq("user_id", userId)
          .eq("pick_id", pickId);
    const { error, status: errorResponseStatus } =
      await request.abortSignal(signal);
    throwIfSupabaseError(
      error,
      API_ERROR_MESSAGES.UPDATE_THE_FOLLOWED_PICK,
      errorResponseStatus,
    );
  });
}
