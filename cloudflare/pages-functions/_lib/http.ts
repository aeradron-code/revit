import type {
  PagesContext,
  PagesEnv,
  SessionRecord,
  StoredSession,
} from "./types";

export const SESSION_COOKIE = "__Host-revit_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const CACHE_CONTROL = "private, no-store, max-age=0";

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", CACHE_CONTROL);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

export function redirectResponse(location: string, headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", CACHE_CONTROL);
  responseHeaders.set("Location", location);
  responseHeaders.set("Referrer-Policy", "no-referrer");
  return new Response(null, { status: 303, headers: responseHeaders });
}

export function getSessionId(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const value = cookie?.slice(SESSION_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function makeSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

export function setSessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; Secure; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

export function assertSameOrigin(request: Request, env: PagesEnv): boolean {
  const origin = request.headers.get("Origin");
  const requestOrigin = getRequestOrigin(request, env);
  return Boolean(origin && requestOrigin && origin === requestOrigin);
}

export function normalizedAppOrigin(env: PagesEnv): string {
  return normalizeAllowedOrigin(env.APP_ORIGIN);
}

export function allowedAppOrigins(env: PagesEnv): string[] {
  const configured = [
    env.APP_ORIGIN,
    ...(env.APP_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];
  return [...new Set(configured.map(normalizeAllowedOrigin))];
}

export function getRequestOrigin(
  request: Request,
  env: PagesEnv,
): string | null {
  try {
    const requestOrigin = new URL(request.url).origin;
    return allowedAppOrigins(env).includes(requestOrigin)
      ? requestOrigin
      : null;
  } catch {
    return null;
  }
}

function normalizeAllowedOrigin(value: string): string {
  try {
    const configured = new URL(value);
    const isLoopback =
      configured.hostname === "localhost" ||
      configured.hostname === "127.0.0.1" ||
      configured.hostname === "[::1]";
    if (
      configured.origin !== value ||
      (configured.protocol !== "https:" &&
        !(configured.protocol === "http:" && isLoopback))
    ) {
      throw new Error("Origins must be HTTPS and cannot include a path.");
    }
    return configured.origin;
  } catch {
    throw new Error("Origins must be HTTPS and cannot include a path.");
  }
}

export function isConfigured(env: PagesEnv): boolean {
  try {
    const supabaseUrl = new URL(env.SUPABASE_URL);
    const isLoopback =
      supabaseUrl.hostname === "localhost" ||
      supabaseUrl.hostname === "127.0.0.1" ||
      supabaseUrl.hostname === "[::1]";
    allowedAppOrigins(env);
    return (
      (supabaseUrl.protocol === "https:" ||
        (supabaseUrl.protocol === "http:" && isLoopback)) &&
      Boolean(env.SUPABASE_PUBLISHABLE_KEY) &&
      Boolean(env.SESSION_STORE)
    );
  } catch {
    return false;
  }
}

export async function readSessionRecord(
  context: PagesContext,
  sessionId: string,
): Promise<SessionRecord | null> {
  const stub = context.env.SESSION_STORE.get(
    context.env.SESSION_STORE.idFromName(sessionId),
  );
  const response = await stub.fetch("https://session-store/session");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not read the auth session.");
  return (await response.json()) as SessionRecord;
}

export async function writeSessionRecord(
  context: PagesContext,
  sessionId: string,
  record: SessionRecord,
): Promise<void> {
  const stub = context.env.SESSION_STORE.get(
    context.env.SESSION_STORE.idFromName(sessionId),
  );
  const response = await stub.fetch("https://session-store/session", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error("Could not save the auth session.");
}

export async function getValidSession(
  context: PagesContext,
  sessionId: string,
): Promise<StoredSession | null> {
  const stub = context.env.SESSION_STORE.get(
    context.env.SESSION_STORE.idFromName(sessionId),
  );
  const response = await stub.fetch("https://session-store/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Could not refresh the auth session.");
  const payload = (await response.json()) as { session: StoredSession | null };
  return payload.session;
}

export async function deleteSession(
  context: PagesContext,
  sessionId: string,
): Promise<void> {
  const stub = context.env.SESSION_STORE.get(
    context.env.SESSION_STORE.idFromName(sessionId),
  );
  await stub.fetch("https://session-store/session", { method: "DELETE" });
}

export async function parseJsonBody<T>(
  request: Request,
  maxBytes = 32_768,
): Promise<T | null> {
  const declaredSize = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredSize > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function toSafeUser(user: unknown) {
  if (!user || typeof user !== "object") return null;
  const candidate = user as Record<string, unknown>;
  if (typeof candidate.id !== "string") return null;
  return {
    id: candidate.id,
    email: typeof candidate.email === "string" ? candidate.email : null,
  };
}
