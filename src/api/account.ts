import { API_ERROR_MESSAGES } from "./errors";
import { runApiRequest } from "./request";
import { throwIfSupabaseError } from "./supabase-errors";
import { clearLocalSession } from "./auth";
import { supabase } from "@/lib/supabase/client";

export function deleteAccount(): Promise<void> {
  return runApiRequest(
    async () => {
      const { error } = await supabase.functions.invoke(
        "request-account-deletion",
        { body: {} },
      );
      throwIfSupabaseError(error, API_ERROR_MESSAGES.DELETE_ACCOUNT);

      await clearLocalSession();
    },
    { message: API_ERROR_MESSAGES.DELETE_ACCOUNT, timeoutMs: 120_000 },
  );
}
