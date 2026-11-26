import { handleAuthRequest } from "../../../cloudflare/pages-functions/_lib/auth-handlers";
import type { PagesContext } from "../../../cloudflare/pages-functions/_lib/types";

export async function onRequest(context: PagesContext): Promise<Response> {
  const pathname = new URL(context.request.url).pathname;
  const action = pathname.replace(/^\/api\/auth\/?/, "").replace(/\/$/, "");
  return handleAuthRequest(context, action);
}
