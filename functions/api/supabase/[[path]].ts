import {
  assertSameOrigin,
  clearSessionCookie,
  getSessionId,
  getValidSession,
  isConfigured,
  jsonResponse,
} from "../../../cloudflare/pages-functions/_lib/http";
import type { PagesContext } from "../../../cloudflare/pages-functions/_lib/types";

const PROXY_PREFIX = "/api/supabase";
const ALLOWED_PREFIXES = ["/rest/v1", "/storage/v1", "/functions/v1"];

function isAllowedSupabasePath(pathname: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!isConfigured(env)) {
    return jsonResponse({ message: "Supabase proxy is not configured." }, 503);
  }

  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return jsonResponse({ message: "Method not allowed." }, 405);
  }
  if (!["GET", "HEAD"].includes(method) && !assertSameOrigin(request, env)) {
    return jsonResponse({ message: "Forbidden." }, 403);
  }

  const incomingUrl = new URL(request.url);
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  const origin = request.headers.get("Origin");
  if (
    (fetchSite && fetchSite !== "same-origin") ||
    (origin && origin !== incomingUrl.origin)
  ) {
    return jsonResponse({ message: "Forbidden." }, 403);
  }
  const upstreamPath = incomingUrl.pathname.slice(PROXY_PREFIX.length);
  if (!isAllowedSupabasePath(upstreamPath)) {
    return jsonResponse({ message: "Not found." }, 404);
  }

  const sessionId = getSessionId(request);
  let accessToken: string | null = null;
  let clearCookie = false;
  if (sessionId) {
    try {
      const session = await getValidSession(context, sessionId);
      accessToken = session?.access_token ?? null;
      clearCookie = !session;
    } catch {
      return jsonResponse({ message: "Auth session is unavailable." }, 503);
    }
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(upstreamPath + incomingUrl.search, env.SUPABASE_URL);
  } catch {
    return jsonResponse({ message: "Supabase proxy is not configured." }, 503);
  }

  const headers = new Headers(request.headers);
  for (const header of [
    "authorization",
    "access-control-allow-origin",
    "access-control-allow-credentials",
    "access-control-allow-headers",
    "access-control-allow-methods",
    "access-control-allow-expose-headers",
    "access-control-max-age",
    "cookie",
    "host",
    "origin",
    "referer",
    "cf-connecting-ip",
    "cf-ray",
    "x-forwarded-for",
  ]) {
    headers.delete(header);
  }
  headers.set("apikey", env.SUPABASE_PUBLISHABLE_KEY);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  } else {
    headers.delete("Authorization");
  }
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) headers.set("X-Forwarded-For", clientIp);

  try {
    const copiedRequest = new Request(upstreamUrl.toString(), request);
    const upstreamRequest = new Request(copiedRequest, {
      headers,
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
    });
    const upstream = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("Set-Cookie");
    for (const header of [
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Credentials",
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Methods",
      "Access-Control-Expose-Headers",
      "Access-Control-Max-Age",
    ]) {
      responseHeaders.delete(header);
    }
    responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    if (clearCookie) {
      responseHeaders.append("Set-Cookie", clearSessionCookie());
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonResponse({ message: "Supabase is unavailable." }, 502);
  }
}
