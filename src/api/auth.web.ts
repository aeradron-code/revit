import type { AuthChangeEvent } from "@supabase/supabase-js";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  normalizeAuthError,
} from "./errors";
import { runApiRequest } from "./request";
import {
  isPasswordRecoveryUrl,
  type AuthCallbackResult,
  type AuthSessionSnapshot,
} from "./auth.shared";

type WebAuthStateResponse = {
  session: AuthSessionSnapshot | null;
  isPasswordRecovery?: boolean;
};

type WebAuthCallback = (
  event: AuthChangeEvent,
  session: AuthSessionSnapshot | null,
) => void;

const webAuthSubscribers = new Set<WebAuthCallback>();
const WEB_AUTH_CHANNEL = "revit-auth-state";
let webAuthBroadcastChannel: BroadcastChannel | null = null;

export type { AuthCallbackResult, AuthSessionSnapshot } from "./auth.shared";
export { isPasswordRecoveryUrl } from "./auth.shared";

function notifyWebAuthState(
  event: AuthChangeEvent,
  session: AuthSessionSnapshot | null,
) {
  for (const callback of webAuthSubscribers) callback(event, session);
  window.dispatchEvent(new Event("revit-auth-state-changed"));
  try {
    webAuthBroadcastChannel ??= new BroadcastChannel(WEB_AUTH_CHANNEL);
    webAuthBroadcastChannel.postMessage("refresh-session");
  } catch {
    // Same-tab updates still work when BroadcastChannel is unavailable.
  }
}

async function readWebAuthState(): Promise<WebAuthStateResponse> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error("Could not load the web auth session.") as Error & {
      status: number;
    };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as WebAuthStateResponse;
}

async function postWebAuth<T>(
  path: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  return runApiRequest(
    async (signal) => {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error =
          result && typeof result === "object" && "error" in result
            ? (result as { error?: { code?: string } }).error
            : undefined;
        throw normalizeAuthError(
          { code: error?.code, status: response.status },
          fallback,
        );
      }
      return result as T;
    },
    { message: fallback },
  );
}

function subscribeToWebAuthState(callback: WebAuthCallback) {
  let active = true;
  let currentUserId: string | null = null;
  const publish = (event: AuthChangeEvent, state: WebAuthStateResponse) => {
    if (!active) return;
    currentUserId = state.session?.user.id ?? null;
    callback(
      state.isPasswordRecovery ? "PASSWORD_RECOVERY" : event,
      state.session,
    );
  };
  const refresh = async () => {
    try {
      const state = await readWebAuthState();
      const nextUserId = state.session?.user.id ?? null;
      const event: AuthChangeEvent =
        nextUserId === currentUserId
          ? "TOKEN_REFRESHED"
          : nextUserId
            ? "SIGNED_IN"
            : "SIGNED_OUT";
      publish(event, state);
    } catch {
      // Keep the last known identity during transient network failures.
    }
  };
  const onSameTabChange = () => void refresh();
  window.addEventListener("revit-auth-state-changed", onSameTabChange);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(WEB_AUTH_CHANNEL);
    channel.addEventListener("message", onSameTabChange);
  } catch {
    channel = null;
  }
  void readWebAuthState()
    .then((state) => publish("INITIAL_SESSION", state))
    .catch(() => publish("INITIAL_SESSION", { session: null }));

  return () => {
    active = false;
    webAuthSubscribers.delete(callback);
    window.removeEventListener("revit-auth-state-changed", onSameTabChange);
    channel?.removeEventListener("message", onSameTabChange);
    channel?.close();
  };
}

export function subscribeToAuthState(callback: WebAuthCallback) {
  webAuthSubscribers.add(callback);
  return subscribeToWebAuthState(callback);
}

export async function handleAuthCallback(
  url: string,
): Promise<AuthCallbackResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return isPasswordRecoveryUrl(url)
      ? { status: "invalid" }
      : { status: "ignored" };
  }
  if (parsed.pathname.replace(/\/$/, "") !== "/auth/update-password") {
    return { status: "ignored" };
  }
  try {
    const state = await readWebAuthState();
    return state.isPasswordRecovery && state.session
      ? { status: "recovery" }
      : { status: "invalid" };
  } catch {
    return { status: "unavailable" };
  }
}

export function signIn(email: string, password: string) {
  return postWebAuth<{ session: AuthSessionSnapshot }>(
    "/api/auth/sign-in",
    { email, password },
    API_ERROR_MESSAGES.SIGN_IN,
  ).then((result) => {
    notifyWebAuthState("SIGNED_IN", result.session);
    return result;
  });
}

export function signInWithGoogle() {
  return postWebAuth<{ url: string }>(
    "/api/auth/oauth/google/start",
    { next: "/" },
    API_ERROR_MESSAGES.SIGN_IN,
  ).then(({ url }) => {
    globalThis.location.assign(url);
  });
}

export function signUp(email: string, password: string) {
  return postWebAuth<{
    session: AuthSessionSnapshot | null;
    user: AuthSessionSnapshot["user"] | null;
  }>("/api/auth/sign-up", { email, password }, API_ERROR_MESSAGES.SIGN_UP).then(
    (result) => {
      if (result.session) notifyWebAuthState("SIGNED_IN", result.session);
      return result;
    },
  );
}

export function requestPasswordReset(email: string, _redirectTo: string) {
  return postWebAuth<{ ok: true }>(
    "/api/auth/password-reset",
    { email },
    API_ERROR_MESSAGES.RESET_PASSWORD,
  ).then(() => undefined);
}

export function updatePassword(password: string) {
  return postWebAuth<{ ok: true }>(
    "/api/auth/password-update",
    { password },
    API_ERROR_MESSAGES.UPDATE_PASSWORD,
  ).then(async () => {
    try {
      const state = await readWebAuthState();
      notifyWebAuthState("USER_UPDATED", state.session);
    } catch {
      // The password update succeeded; the next auth refresh will reconcile state.
    }
  });
}

export function signOut() {
  return postWebAuth<{ ok: true }>(
    "/api/auth/sign-out",
    {},
    API_ERROR_MESSAGES.SIGN_OUT,
  ).then(() => {
    notifyWebAuthState("SIGNED_OUT", null);
  });
}

export async function clearLocalSession(): Promise<void> {
  await postWebAuth<{ ok: true }>(
    "/api/auth/sign-out",
    {},
    API_ERROR_MESSAGES.SIGN_OUT,
  );
  notifyWebAuthState("SIGNED_OUT", null);
}
