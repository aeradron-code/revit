import type { Session } from "@supabase/supabase-js";

export type AuthSessionSnapshot = {
  user: Pick<Session["user"], "id"> & { email: string | null };
};

export type AuthCallbackResult =
  | { status: "ignored" }
  | { status: "recovery" }
  | { status: "signed-in" }
  | { status: "invalid" }
  | { status: "unavailable" };

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
