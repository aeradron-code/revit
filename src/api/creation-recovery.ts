import { throwIfSupabaseError } from "./supabase-errors";
import { randomUUID } from "expo-crypto";
import type { AskImageUpload } from "@/api/posts";
import { supabase } from "@/lib/supabase/client";
import { API_ERROR_MESSAGES } from "./errors";
import { runApiRequest } from "./request";

export type ResourceCreationKind = "FORUM" | "FIND";
export type ResourceCreationAttempt = {
  id: string;
  outcomeUncertain?: boolean;
  uploadedPaths?: { image?: string; cover?: string };
  preparedImages?: { image?: AskImageUpload; cover?: AskImageUpload };
};

export function rotateResourceAttempt(attempt: ResourceCreationAttempt) {
  attempt.id = randomUUID();
  attempt.uploadedPaths = undefined;
}

export function lookupResourceCreation(
  operationId: string,
  kind: ResourceCreationKind,
): Promise<string | null> {
  return runApiRequest(
    async (signal) => {
      const { data, error, status } = await supabase
        .rpc("lookup_resource_creation", {
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
      return data?.resource_id ?? null;
    },
    { retries: 1, message: API_ERROR_MESSAGES.CHECK_ASK_CREATION },
  );
}

export function isDefiniteCreationRejection(
  error: { code?: string },
  wasUncertain: boolean,
) {
  return (
    !wasUncertain &&
    typeof error.code === "string" &&
    /^(22|23|28|42)[0-9A-Z]{3}$/.test(error.code)
  );
}
