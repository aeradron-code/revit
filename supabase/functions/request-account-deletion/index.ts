import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const buckets = ["entity-images", "forum-images", "post-images"] as const;
const LIST_PAGE_SIZE = 100;
const REMOVE_BATCH_SIZE = 1000;

type FailureStage = "entity_images" | "storage" | "auth";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function defaultKey(primaryName: string, legacyName: string): string | null {
  const raw = Deno.env.get(primaryName);
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Older projects expose the legacy key in its own environment variable.
    }
  }
  return Deno.env.get(legacyName) ?? null;
}

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = defaultKey(
    "SUPABASE_SECRET_KEYS",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  if (!url || !secretKey) throw new Error("missing_server_configuration");

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function createUserClient(authorization: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = defaultKey(
    "SUPABASE_PUBLISHABLE_KEYS",
    "SUPABASE_ANON_KEY",
  );
  if (!url || !publishableKey) throw new Error("missing_server_configuration");

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: authorization } },
  });
}

async function listOwnedFiles(
  admin: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<string[]> {
  const paths: string[] = [];

  async function visit(folderPath: string): Promise<void> {
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(folderPath, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`storage_list_${bucket}`);

      for (const entry of data ?? []) {
        const itemPath = `${folderPath}/${entry.name}`;
        if (entry.id === null) {
          await visit(itemPath);
        } else {
          paths.push(itemPath);
        }
      }

      if (!data || data.length < LIST_PAGE_SIZE) break;
      offset += data.length;
    }
  }

  await visit(userId);
  return paths;
}

async function removeOwnedFiles(
  admin: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let offset = 0; offset < paths.length; offset += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(offset, offset + REMOVE_BATCH_SIZE);
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (error) throw new Error(`storage_remove_${bucket}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response(405, { error: "method_not_allowed" });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response(401, { error: "unauthorized" });
  }

  let admin: SupabaseClient;
  let user: SupabaseClient;
  try {
    admin = createAdminClient();
    user = createUserClient(authorization);
  } catch {
    return response(500, { error: "server_configuration" });
  }

  const accessToken = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } =
    await user.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return response(401, { error: "unauthorized" });
  }

  const userId = authData.user.id;
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_account_deletion_job",
    { p_user_id: userId },
  );
  if (claimError) return response(500, { error: "deletion_unavailable" });
  if (!claimed) {
    return response(409, { error: "deletion_already_processing" });
  }

  let failureStage: FailureStage = "entity_images";
  try {
    // Shared catalog rows remain, but images uploaded by this account do not.
    const { error: entityError } = await admin
      .from("entities")
      .update({ image_url: null })
      .eq("created_by", userId);
    if (entityError) throw new Error("entity_images");

    failureStage = "storage";
    for (const bucket of buckets) {
      const paths = await listOwnedFiles(admin, bucket, userId);
      await removeOwnedFiles(admin, bucket, paths);
    }

    failureStage = "auth";
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error("auth_delete");

    // The job row cascades away when the Auth user is deleted.
    return response(200, { deleted: true });
  } catch {
    await admin
      .from("account_deletion_jobs")
      .update({
        last_error: failureStage,
        locked_until: null,
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return response(500, { error: "deletion_failed", retryable: true });
  }
});
