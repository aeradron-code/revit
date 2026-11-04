import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase/client";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  normalizeApiError,
} from "./errors";
import { runApiRequest } from "./request";
import { throwIfAuthError } from "./supabase-errors";

export type AuthCallbackResult =
  | { status: "ignored" }
  | { status: "recovery" }
  | { status: "signed-in" }
  | { status: "invalid" }
  | { status: "unavailable" };

/** Keep Supabase's auth listener behind the same boundary as auth requests. */
export function subscribeToAuthState(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

/** Exchange supported password-recovery callbacks without exposing the client to UI. */
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

  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const code = parsed.searchParams.get("code");
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const isRecoveryCallback =
    url.includes("auth/update-password") &&
    (parsed.searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery" ||
      Boolean(code) ||
      Boolean(accessToken));

  const callbackPath = parsed.pathname.replace(/\/$/, "");
  if (!isRecoveryCallback && code && callbackPath === "/auth") {
    try {
      await runApiRequest(
        async () => {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          throwIfAuthError(error, API_ERROR_MESSAGES.SIGN_IN);
        },
        { message: API_ERROR_MESSAGES.SIGN_IN },
      );
      return { status: "signed-in" };
    } catch {
      return { status: "invalid" };
    }
  }

  if (!isRecoveryCallback) {
    return isPasswordRecoveryUrl(url)
      ? { status: "invalid" }
      : { status: "ignored" };
  }

  if (!code && !(accessToken && refreshToken)) return { status: "invalid" };

  try {
    await runApiRequest(
      async () => {
        const { error } = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.setSession({
              access_token: accessToken as string,
              refresh_token: refreshToken as string,
            });
        throwIfAuthError(error, API_ERROR_MESSAGES.PASSWORD_RESET_LINK_INVALID);
      },
      { message: API_ERROR_MESSAGES.PASSWORD_RESET_LINK_INVALID },
    );
    return { status: "recovery" };
  } catch (error) {
    const normalized = normalizeApiError(
      error,
      API_ERROR_MESSAGES.PASSWORD_RESET_LINK_UNAVAILABLE,
    );
    return {
      status:
        normalized.code === API_ERROR_CODES.NETWORK_ERROR ||
        normalized.code === API_ERROR_CODES.TIMEOUT ||
        normalized.code === API_ERROR_CODES.SERVER_ERROR
          ? "unavailable"
          : "invalid",
    };
  }
}

export function isPasswordRecoveryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    return (
      url.includes("auth/update-password") ||
      parsed.searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery"
    );
  } catch {
    return url.includes("auth/update-password");
  }
}

export function signIn(email: string, password: string) {
  return runApiRequest(
    async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      throwIfAuthError(error, API_ERROR_MESSAGES.SIGN_IN);
      return data;
    },
    { message: API_ERROR_MESSAGES.SIGN_IN },
  );
}

export function signInWithGoogle() {
  return runApiRequest(
    async () => {
      const redirectTo =
        Platform.OS === "web" ? Linking.createURL("auth") : "revit://auth";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== "web",
        },
      });
      throwIfAuthError(error, API_ERROR_MESSAGES.SIGN_IN);

      if (Platform.OS === "web") return;
      if (!data.url) throw new Error(API_ERROR_MESSAGES.SIGN_IN);

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type !== "success") return;

      const callbackUrl = new URL(result.url);
      const code = callbackUrl.searchParams.get("code");
      if (!code) throw new Error(API_ERROR_MESSAGES.SIGN_IN);

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      throwIfAuthError(exchangeError, API_ERROR_MESSAGES.SIGN_IN);
    },
    { message: API_ERROR_MESSAGES.SIGN_IN },
  );
}

export function signUp(email: string, password: string) {
  return runApiRequest(
    async () => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      throwIfAuthError(error, API_ERROR_MESSAGES.SIGN_UP);
      return data;
    },
    { message: API_ERROR_MESSAGES.SIGN_UP },
  );
}

export function requestPasswordReset(email: string, redirectTo: string) {
  return runApiRequest(
    async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      throwIfAuthError(error, API_ERROR_MESSAGES.RESET_PASSWORD);
    },
    { message: API_ERROR_MESSAGES.RESET_PASSWORD },
  );
}

export function updatePassword(password: string) {
  return runApiRequest(
    async () => {
      const { error } = await supabase.auth.updateUser({ password });
      throwIfAuthError(error, API_ERROR_MESSAGES.UPDATE_PASSWORD);
    },
    { message: API_ERROR_MESSAGES.UPDATE_PASSWORD },
  );
}

export function signOut() {
  return runApiRequest(
    async () => {
      const { error } = await supabase.auth.signOut();
      throwIfAuthError(error, API_ERROR_MESSAGES.SIGN_OUT);
    },
    { message: API_ERROR_MESSAGES.SIGN_OUT },
  );
}
