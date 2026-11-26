import {
  assertSameOrigin,
  allowedAppOrigins,
  clearSessionCookie,
  deleteSession,
  getSessionId,
  getRequestOrigin,
  getValidSession,
  isConfigured,
  jsonResponse,
  makeSessionId,
  normalizedAppOrigin,
  parseJsonBody,
  readSessionRecord,
  redirectResponse,
  setSessionCookie,
  toBase64Url,
  toSafeUser,
  writeSessionRecord,
} from "./http";
import type {
  AuthUser,
  PagesContext,
  SessionRecord,
  StoredSession,
} from "./types";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_FLOW_MAX_AGE_MS = 10 * 60 * 1000;
type AuthResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  expires_at?: unknown;
  token_type?: unknown;
  user?: unknown;
};

type AuthActionBody = {
  email?: unknown;
  password?: unknown;
};

async function callSupabaseAuth(
  context: PagesContext,
  pathname: string,
  options: {
    body?: unknown;
    method?: string;
    accessToken?: string;
  } = {},
): Promise<Response> {
  const url = new URL(
    `/auth/v1/${pathname.replace(/^\//, "")}`,
    context.env.SUPABASE_URL,
  );
  const headers = new Headers({
    apikey: context.env.SUPABASE_PUBLISHABLE_KEY,
    Accept: "application/json",
  });
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }
  const clientIp = context.request.headers.get("CF-Connecting-IP");
  if (clientIp) headers.set("X-Forwarded-For", clientIp);

  return fetch(url, {
    method: options.method ?? "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
    cache: "no-store",
  });
}

async function readUpstreamJson(response: Response): Promise<AuthResponse> {
  try {
    return (await response.json()) as AuthResponse;
  } catch {
    return {};
  }
}

function upstreamErrorCode(response: Response, body: AuthResponse): string {
  const error = body as Record<string, unknown>;
  const candidate = error.code ?? error.error_code ?? error.error;
  if (typeof candidate === "string" && /^[a-z0-9_-]{1,64}$/i.test(candidate)) {
    return candidate.toLowerCase();
  }
  if (response.status === 429) return "rate_limit_exceeded";
  if (response.status === 401 || response.status === 400) {
    return "invalid_credentials";
  }
  return "auth_request_failed";
}

function authFailure(response: Response, body: AuthResponse): Response {
  const code = upstreamErrorCode(response, body);
  const status =
    response.status >= 400 && response.status < 600 ? response.status : 502;
  return jsonResponse({ error: { code } }, status);
}

function sessionFromAuthResponse(
  response: AuthResponse,
  options: { isPasswordRecovery?: boolean } = {},
): StoredSession | null {
  const user = toSafeUser(response.user) as AuthUser | null;
  if (
    typeof response.access_token !== "string" ||
    typeof response.refresh_token !== "string" ||
    !user
  ) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt =
    typeof response.expires_at === "number"
      ? response.expires_at
      : now +
        (typeof response.expires_in === "number" ? response.expires_in : 3600);
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: expiresAt,
    token_type:
      typeof response.token_type === "string" ? response.token_type : "bearer",
    user,
    isPasswordRecovery: options.isPasswordRecovery ?? false,
  };
}

async function createSession(
  context: PagesContext,
  session: StoredSession,
): Promise<Response> {
  const previousSessionId = getSessionId(context.request);
  const sessionId = makeSessionId();
  const record: SessionRecord = {
    expires_at: Date.now() + SESSION_MAX_AGE_MS,
    session,
  };
  await writeSessionRecord(context, sessionId, record);
  if (previousSessionId) await deleteSession(context, previousSessionId);
  return jsonResponse(
    {
      session: { user: session.user },
      user: session.user,
    },
    200,
    { "Set-Cookie": setSessionCookie(sessionId) },
  );
}

function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 320 &&
    /^\S+@\S+\.\S+$/.test(value)
  );
}

function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function isValidNewPassword(value: unknown): value is string {
  return isValidPassword(value) && value.length >= 8;
}

function safeNextForContext(
  context: PagesContext,
  value: string | null,
  fallback: string,
) {
  if (!value || value.length > 2048 || value.includes("\\")) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) {
    try {
      const candidate = new URL(value);
      if (!allowedAppOrigins(context.env).includes(candidate.origin))
        return fallback;
      return `${candidate.pathname}${candidate.search}`;
    } catch {
      return fallback;
    }
  }
  try {
    const appOrigin = normalizedAppOrigin(context.env);
    const candidate = new URL(value, appOrigin);
    if (candidate.origin !== appOrigin) return fallback;
    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return fallback;
  }
}

function randomToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function createPkcePair() {
  const verifier = randomToken();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = toBase64Url(new Uint8Array(digest));
  return { verifier, challenge };
}

function sameOriginFailure() {
  return jsonResponse({ error: { code: "forbidden" } }, 403);
}

export async function handleAuthRequest(
  context: PagesContext,
  action: string,
): Promise<Response> {
  if (!isConfigured(context.env)) {
    return jsonResponse({ error: { code: "auth_not_configured" } }, 503);
  }

  const { request, env } = context;
  const requestOrigin = getRequestOrigin(request, env);
  if (!requestOrigin) {
    return jsonResponse({ error: { code: "invalid_origin" } }, 400);
  }

  if (action === "session" && request.method === "GET") {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return jsonResponse({ session: null, isPasswordRecovery: false });
    }
    try {
      const session = await getValidSession(context, sessionId);
      if (!session) {
        return jsonResponse({ session: null, isPasswordRecovery: false }, 200, {
          "Set-Cookie": clearSessionCookie(),
        });
      }
      return jsonResponse({
        session: { user: session.user },
        isPasswordRecovery: Boolean(session.isPasswordRecovery),
      });
    } catch {
      return jsonResponse({ error: { code: "session_unavailable" } }, 503);
    }
  }

  if (action === "oauth/google/start" && request.method === "POST") {
    if (!assertSameOrigin(request, env)) return sameOriginFailure();
    const body = await parseJsonBody<{ next?: unknown }>(request, 4096);
    const next = safeNextForContext(
      context,
      typeof body?.next === "string" ? body.next : null,
      "/",
    );
    const { verifier, challenge } = await createPkcePair();
    const sessionId = makeSessionId();
    const flow = randomToken();
    const callback = new URL("/api/auth/oauth/callback", requestOrigin);
    callback.searchParams.set("flow", flow);
    const authorizeUrl = new URL("/auth/v1/authorize", env.SUPABASE_URL);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", callback.toString());
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "s256");
    const record: SessionRecord = {
      expires_at: Date.now() + OAUTH_FLOW_MAX_AGE_MS,
      flow: {
        type: "oauth",
        flow,
        verifier,
        next,
        expires_at: Date.now() + OAUTH_FLOW_MAX_AGE_MS,
      },
    };
    try {
      await writeSessionRecord(context, sessionId, record);
      const previousSessionId = getSessionId(request);
      if (previousSessionId) await deleteSession(context, previousSessionId);
      return jsonResponse({ url: authorizeUrl.toString() }, 200, {
        "Set-Cookie": setSessionCookie(sessionId),
      });
    } catch {
      return jsonResponse({ error: { code: "session_unavailable" } }, 503);
    }
  }

  if (action === "oauth/callback" && request.method === "GET") {
    const url = new URL(request.url);
    const sessionId = getSessionId(request);
    const code = url.searchParams.get("code");
    const flow = url.searchParams.get("flow");
    if (!sessionId || !code || !flow || code.length > 4096) {
      return redirectResponse(
        new URL("/auth?error=oauth", requestOrigin).toString(),
        {
          "Set-Cookie": clearSessionCookie(),
        },
      );
    }
    try {
      const record = await readSessionRecord(context, sessionId);
      if (
        !record?.flow ||
        record.flow.flow !== flow ||
        record.flow.expires_at <= Date.now()
      ) {
        await deleteSession(context, sessionId);
        return redirectResponse(
          new URL("/auth?error=oauth", requestOrigin).toString(),
          {
            "Set-Cookie": clearSessionCookie(),
          },
        );
      }
      const response = await callSupabaseAuth(
        context,
        "token?grant_type=pkce",
        {
          body: { auth_code: code, code_verifier: record.flow.verifier },
        },
      );
      const data = await readUpstreamJson(response);
      if (!response.ok) {
        await deleteSession(context, sessionId);
        return redirectResponse(
          new URL("/auth?error=oauth", requestOrigin).toString(),
          {
            "Set-Cookie": clearSessionCookie(),
          },
        );
      }
      const session = sessionFromAuthResponse(data);
      if (!session) {
        await deleteSession(context, sessionId);
        return redirectResponse(
          new URL("/auth?error=oauth", requestOrigin).toString(),
          {
            "Set-Cookie": clearSessionCookie(),
          },
        );
      }
      await writeSessionRecord(context, sessionId, {
        expires_at: Date.now() + SESSION_MAX_AGE_MS,
        session,
      });
      return redirectResponse(
        new URL(record.flow.next, requestOrigin).toString(),
        { "Set-Cookie": setSessionCookie(sessionId) },
      );
    } catch {
      await deleteSession(context, sessionId).catch(() => undefined);
      return redirectResponse(
        new URL("/auth?error=oauth", requestOrigin).toString(),
        {
          "Set-Cookie": clearSessionCookie(),
        },
      );
    }
  }

  if (action === "verify" && request.method === "GET") {
    const url = new URL(request.url);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    const allowedTypes = new Set([
      "recovery",
      "email",
      "signup",
      "invite",
      "magiclink",
    ]);
    if (
      !tokenHash ||
      tokenHash.length > 2048 ||
      !type ||
      !allowedTypes.has(type)
    ) {
      return redirectResponse(
        new URL("/auth?error=verification", requestOrigin).toString(),
      );
    }
    const redirectTo = url.searchParams.get("redirect_to");
    if (redirectTo) {
      try {
        if (!allowedAppOrigins(env).includes(new URL(redirectTo).origin)) {
          return jsonResponse({ error: { code: "invalid_redirect" } }, 400);
        }
      } catch {
        return jsonResponse({ error: { code: "invalid_redirect" } }, 400);
      }
    }
    const response = await callSupabaseAuth(context, "verify", {
      body: { token_hash: tokenHash, type },
    });
    const data = await readUpstreamJson(response);
    const session = response.ok
      ? sessionFromAuthResponse(data, {
          isPasswordRecovery: type === "recovery",
        })
      : null;
    if (!session) {
      return redirectResponse(
        new URL(
          type === "recovery"
            ? "/auth/update-password?error=invalid-link"
            : "/auth?error=verification",
          requestOrigin,
        ).toString(),
      );
    }
    const sessionId = makeSessionId();
    try {
      await writeSessionRecord(context, sessionId, {
        expires_at: Date.now() + SESSION_MAX_AGE_MS,
        session,
      });
      const previousSessionId = getSessionId(request);
      if (previousSessionId) await deleteSession(context, previousSessionId);
    } catch {
      return redirectResponse(
        new URL("/auth?error=verification", requestOrigin).toString(),
      );
    }
    const destination = type === "recovery" ? "/auth/update-password" : "/auth";
    return redirectResponse(new URL(destination, requestOrigin).toString(), {
      "Set-Cookie": setSessionCookie(sessionId),
    });
  }

  if (request.method !== "POST" || !assertSameOrigin(request, env)) {
    if (request.method === "GET" || request.method === "HEAD") {
      return jsonResponse({ error: { code: "not_found" } }, 404);
    }
    return sameOriginFailure();
  }

  if (action === "sign-in") {
    const body = await parseJsonBody<AuthActionBody>(request);
    if (!isValidEmail(body?.email) || !isValidPassword(body?.password)) {
      return jsonResponse({ error: { code: "invalid_request" } }, 400);
    }
    const response = await callSupabaseAuth(
      context,
      "token?grant_type=password",
      {
        body: { email: body.email.trim(), password: body.password },
      },
    );
    const data = await readUpstreamJson(response);
    if (!response.ok) return authFailure(response, data);
    const session = sessionFromAuthResponse(data);
    if (!session)
      return jsonResponse({ error: { code: "invalid_auth_response" } }, 502);
    try {
      return await createSession(context, session);
    } catch {
      return jsonResponse({ error: { code: "session_unavailable" } }, 503);
    }
  }

  if (action === "sign-up") {
    const body = await parseJsonBody<AuthActionBody>(request);
    if (!isValidEmail(body?.email) || !isValidNewPassword(body?.password)) {
      return jsonResponse({ error: { code: "invalid_request" } }, 400);
    }
    const redirectTo = new URL("/api/auth/verify", requestOrigin).toString();
    const response = await callSupabaseAuth(
      context,
      `signup?${new URLSearchParams({ redirect_to: redirectTo })}`,
      { body: { email: body.email.trim(), password: body.password } },
    );
    const data = await readUpstreamJson(response);
    if (!response.ok) return authFailure(response, data);
    const session = sessionFromAuthResponse(data);
    if (!session) {
      const user = toSafeUser(data.user);
      return jsonResponse({ session: null, user });
    }
    try {
      return await createSession(context, session);
    } catch {
      return jsonResponse({ error: { code: "session_unavailable" } }, 503);
    }
  }

  if (action === "password-reset") {
    const body = await parseJsonBody<{ email?: unknown }>(request);
    if (!isValidEmail(body?.email)) {
      return jsonResponse({ error: { code: "invalid_request" } }, 400);
    }
    const redirectTo = new URL("/api/auth/verify", requestOrigin).toString();
    const response = await callSupabaseAuth(
      context,
      `recover?${new URLSearchParams({ redirect_to: redirectTo })}`,
      { body: { email: body.email.trim() } },
    );
    if (!response.ok && response.status !== 429) {
      return jsonResponse({ error: { code: "reset_request_failed" } }, 502);
    }
    return jsonResponse({ ok: true });
  }

  if (action === "password-update") {
    const body = await parseJsonBody<{ password?: unknown }>(request);
    if (!isValidPassword(body?.password) || body.password.length < 8) {
      return jsonResponse({ error: { code: "invalid_request" } }, 400);
    }
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return jsonResponse({ error: { code: "unauthenticated" } }, 401);
    }
    let session: StoredSession | null;
    try {
      session = await getValidSession(context, sessionId);
    } catch {
      return jsonResponse({ error: { code: "session_unavailable" } }, 503);
    }
    if (!session) {
      return jsonResponse({ error: { code: "unauthenticated" } }, 401, {
        "Set-Cookie": clearSessionCookie(),
      });
    }
    const response = await callSupabaseAuth(context, "user", {
      method: "PUT",
      body: { password: body.password },
      accessToken: session.access_token,
    });
    const data = await readUpstreamJson(response);
    if (!response.ok) return authFailure(response, data);
    session.isPasswordRecovery = false;
    try {
      await writeSessionRecord(context, sessionId, {
        expires_at: Date.now() + SESSION_MAX_AGE_MS,
        session,
      });
      return jsonResponse({ ok: true });
    } catch {
      return jsonResponse({ error: { code: "session_unavailable" } }, 503);
    }
  }

  if (action === "sign-out") {
    const sessionId = getSessionId(request);
    try {
      if (sessionId) {
        const session = await getValidSession(context, sessionId).catch(
          () => null,
        );
        if (session) {
          await callSupabaseAuth(context, "logout", {
            method: "POST",
            accessToken: session.access_token,
          }).catch(() => undefined);
        }
        await deleteSession(context, sessionId);
      }
    } catch {
      return jsonResponse({ error: { code: "session_unavailable" } }, 503);
    }
    return jsonResponse({ ok: true }, 200, {
      "Set-Cookie": clearSessionCookie(),
    });
  }

  return jsonResponse({ error: { code: "not_found" } }, 404);
}
