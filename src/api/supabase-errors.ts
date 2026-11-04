import {
  normalizeApiError,
  normalizeAuthError,
  normalizeStorageError,
} from "./errors";

/** Normalize and throw a Supabase database error when a response contains one. */
export function throwIfSupabaseError(
  error: unknown,
  fallback: string,
  status?: number,
): asserts error is null | undefined {
  if (error) throw normalizeApiError(error, fallback, status);
}

/** Normalize and throw a Supabase Storage error when a response contains one. */
export function throwIfStorageError(
  error: unknown,
  fallback: string,
): asserts error is null | undefined {
  if (error) throw normalizeStorageError(error, fallback);
}

/** Normalize and throw a Supabase Auth error when an operation returns one. */
export function throwIfAuthError(
  error: unknown,
  fallback: string,
): asserts error is null | undefined {
  if (error) throw normalizeAuthError(error, fallback);
}
