import type { AskImageUpload } from "@/api/posts";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import {
  isDefiniteCreationRejection,
  type ResourceCreationAttempt,
  rotateResourceAttempt,
} from "./creation-recovery";

import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  ApiError,
  validationError,
} from "./errors";
import { runApiRequest } from "./request";
import { throwIfStorageError, throwIfSupabaseError } from "./supabase-errors";

const ENTITY_SEARCH_LIMIT = 20;

export type EntityCategory = Pick<
  Tables<"entity_categories">,
  "id" | "label" | "slug"
>;
export const ENTITY_CATEGORIES = [
  { slug: "book", label: "Books" },
  { slug: "movie", label: "Movies" },
  { slug: "product", label: "Products" },
  { slug: "place", label: "Places" },
  { slug: "service", label: "Services" },
] as const;
export type Entity = Pick<
  Tables<"entities">,
  | "address_line_1"
  | "address_line_2"
  | "state"
  | "category_id"
  | "country"
  | "created_by"
  | "description"
  | "id"
  | "image_url"
  | "locality"
  | "district"
  | "name"
  | "postal_code"
> & { category: EntityCategory };

export type CreateEntityInput = {
  attempt: ResourceCreationAttempt;
  authorId: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  state?: string | null;
  district?: string | null;
  categorySlug: string;
  country?: string | null;
  description?: string | null;
  image?: AskImageUpload;
  locality?: string | null;
  name: string;
  postal_code?: string | null;
};

const ENTITY_SELECT =
  "id, created_by, category_id, name, description, image_url, address_line_1, address_line_2, locality, district, state, country, postal_code, category:entity_categories!inner(id, slug, label)";

export function getEntityCategories(
  requestSignal?: AbortSignal,
): Promise<EntityCategory[]> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("entity_categories")
        .select("id, slug, label")
        .order("label", { ascending: true })
        .abortSignal(signal);
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_CATEGORIES,
        errorResponseStatus,
      );
      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

export async function createEntity(input: CreateEntityInput): Promise<Entity> {
  const name = input.name.trim();
  if (!name)
    throw validationError(API_ERROR_MESSAGES.A_FIND_NAME_IS_REQUIRED, {
      name: API_ERROR_MESSAGES.A_FIND_NAME_IS_REQUIRED,
    });
  if (
    input.image &&
    (input.image.data.byteLength === 0 ||
      input.image.data.byteLength > 10 * 1024 * 1024)
  ) {
    throw validationError(
      API_ERROR_MESSAGES.THE_FIND_IMAGE_MUST_BE_SMALLER_THAN_10_MB,
      {
        image: API_ERROR_MESSAGES.THE_FIND_IMAGE_MUST_BE_SMALLER_THAN_10_MB,
      },
    );
  }
  const categories = await getEntityCategories();
  const category = categories.find(
    (item) => item.slug === input.categorySlug.trim().toLowerCase(),
  );
  if (!category)
    throw validationError(API_ERROR_MESSAGES.CHOOSE_ENTITY_CATEGORY, {
      categorySlug: API_ERROR_MESSAGES.CHOOSE_ENTITY_CATEGORY,
    });
  const entityId = input.attempt.id;
  if (!input.attempt.uploadedPaths) {
    let uploadedPath: string | undefined;
    try {
      if (input.image) {
        const image = input.image;
        const path = `${input.authorId}/${entityId}.${input.image.extension}`;
        uploadedPath = path;
        const { error: uploadError } = await runApiRequest(() =>
          supabase.storage.from("entity-images").upload(path, image.data, {
            cacheControl: "31536000",
            contentType: image.contentType,
            upsert: false,
          }),
        );
        throwIfStorageError(
          uploadError,
          API_ERROR_MESSAGES.UPLOAD_THE_FIND_IMAGE,
        );
      }
      input.attempt.uploadedPaths = { image: uploadedPath };
    } catch (error) {
      rotateResourceAttempt(input.attempt);
      throw error;
    }
  }
  const uploadedPath = input.attempt.uploadedPaths.image;
  const imageUrl = uploadedPath
    ? supabase.storage.from("entity-images").getPublicUrl(uploadedPath).data
        .publicUrl
    : undefined;
  const wasUncertain = Boolean(input.attempt.outcomeUncertain);
  input.attempt.outcomeUncertain = true;
  return runApiRequest(async (signal) => {
    // Once the create request starts, a lost response can leave its outcome
    // unknown. Do not remove an image that a committed entity may reference.
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .rpc("create_find_idempotent", {
        p_operation_id: entityId,
        p_entity_id: entityId,
        p_image_path: uploadedPath,
        p_category_slug: input.categorySlug,
        p_name: name,
        p_description: nullIfBlank(input.description),
        p_image_url: imageUrl,
        p_address_line_1: nullIfBlank(input.address_line_1),
        p_address_line_2: nullIfBlank(input.address_line_2),
        p_locality: nullIfBlank(input.locality),
        p_district: nullIfBlank(input.district),
        p_state: nullIfBlank(input.state),
        p_country: nullIfBlank(input.country),
        p_postal_code: nullIfBlank(input.postal_code),
      })
      .abortSignal(signal);
    if (error) {
      if (isDefiniteCreationRejection(error, wasUncertain))
        input.attempt.outcomeUncertain = false;
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.ADD_THIS_FIND,
        errorResponseStatus,
      );
    }
    input.attempt.outcomeUncertain = false;
    return { ...data, category };
  });
}

export function getEntity(
  entityId: string,
  requestSignal?: AbortSignal,
): Promise<Entity | null> {
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("entities")
        .select(ENTITY_SELECT)
        .eq("id", entityId)
        .abortSignal(signal)
        .maybeSingle();
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_THIS_FIND,
        errorResponseStatus,
      );
      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function getEntitiesByIds(
  entityIds: string[],
  requestSignal?: AbortSignal,
): Promise<Entity[]> {
  if (!entityIds.length) return Promise.resolve([]);
  return runApiRequest(
    async (signal) => {
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await supabase
        .from("entities")
        .select(ENTITY_SELECT)
        .in("id", entityIds)
        .abortSignal(signal);
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.LOAD_FINDS,
        errorResponseStatus,
      );
      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

export function searchEntities(
  query: string,
  categorySlug?: string,
  requestSignal?: AbortSignal,
): Promise<Entity[]> {
  const term = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!term) return Promise.resolve([]);
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  return runApiRequest(
    async (signal) => {
      let request = supabase
        .from("entities")
        .select(ENTITY_SELECT)
        .or(
          `normalized_name.ilike.${pattern},normalized_locality.ilike.${pattern},normalized_address.ilike.${pattern}`,
        )
        .order("normalized_name", { ascending: true })
        .limit(ENTITY_SEARCH_LIMIT);
      if (categorySlug) request = request.eq("category.slug", categorySlug);
      const {
        data,
        error,
        status: errorResponseStatus,
      } = await request.abortSignal(signal);
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.SEARCH_FINDS,
        errorResponseStatus,
      );
      return data;
    },
    { retries: 1, signal: requestSignal },
  );
}

function nullIfBlank(value: string | null | undefined) {
  return value?.trim() || undefined;
}

export function deleteEntity(entityId: string): Promise<void> {
  return runApiRequest(async (signal) => {
    const {
      data,
      error,
      status: errorResponseStatus,
    } = await supabase
      .from("entities")
      .delete()
      .eq("id", entityId)
      .select("id")
      .abortSignal(signal)
      .maybeSingle();
    if (error) {
      if (error.code === "23503")
        throw new ApiError(API_ERROR_MESSAGES.FIND_IN_USE, {
          code: API_ERROR_CODES.CONFLICT,
          cause: error,
          status: errorResponseStatus,
        });
      throwIfSupabaseError(
        error,
        API_ERROR_MESSAGES.DELETE_THIS_FIND,
        errorResponseStatus,
      );
    }
    if (!data) throw new ApiError(API_ERROR_MESSAGES.FIND_DELETE_DENIED);
  });
}
