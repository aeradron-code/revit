import "react-native-url-polyfill/auto";

import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { authStorage } from "./auth-storage";
import type { Database } from "./database.types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing required Supabase environment variables.");
}

type DevelopmentGlobal = typeof globalThis & {
  __revitSupabaseClient?: SupabaseClient<Database>;
  __revitSupabaseAppStateRegistered?: boolean;
};

function createWebSupabaseFetch(url: string): typeof fetch {
  const supabaseOrigin = new URL(url).origin;
  return async (input, init) => {
    const inputUrl =
      typeof input === "string" || input instanceof URL
        ? new URL(input.toString(), globalThis.location.origin)
        : new URL(input.url);
    if (inputUrl.origin !== supabaseOrigin) return fetch(input, init);

    if (/^\/auth\/v1(?:\/|$)/.test(inputUrl.pathname)) {
      throw new Error("Web Supabase Auth is managed by the server.");
    }

    if (
      !/^\/(?:rest\/v1|storage\/v1|functions\/v1)(?:\/|$)/.test(
        inputUrl.pathname,
      )
    ) {
      throw new Error("Unsupported direct Supabase request from the browser.");
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.delete("authorization");
    const proxiedUrl = new URL(
      `/api/supabase${inputUrl.pathname}${inputUrl.search}`,
      globalThis.location.origin,
    );
    const proxyInit: RequestInit & { duplex?: "half" } = {
      ...init,
      method:
        init?.method ?? (input instanceof Request ? input.method : undefined),
      headers,
      credentials: "same-origin",
      cache: "no-store",
    };
    if (!init?.body && input instanceof Request && input.body) {
      proxyInit.body = input.clone().body;
      proxyInit.duplex = "half";
    }
    return fetch(proxiedUrl, proxyInit);
  };
}

const developmentGlobal = globalThis as DevelopmentGlobal;

function createSupabaseClient(url: string, key: string) {
  const isWeb = Platform.OS === "web";
  return createClient<Database>(url, key, {
    auth: {
      flowType: "pkce",
      storage: authStorage,
      autoRefreshToken: !isWeb,
      persistSession: !isWeb,
      detectSessionInUrl: false,
    },
    global: isWeb ? { fetch: createWebSupabaseFetch(url) } : undefined,
  });
}

function getDevelopmentSupabase(url: string, key: string) {
  if (!developmentGlobal.__revitSupabaseClient) {
    developmentGlobal.__revitSupabaseClient = createSupabaseClient(url, key);
  }

  return developmentGlobal.__revitSupabaseClient;
}

export const supabase = __DEV__
  ? getDevelopmentSupabase(supabaseUrl, supabaseKey)
  : createSupabaseClient(supabaseUrl, supabaseKey);

const shouldRegisterAppState =
  !__DEV__ || !developmentGlobal.__revitSupabaseAppStateRegistered;

if (Platform.OS !== "web" && shouldRegisterAppState) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  if (__DEV__) {
    developmentGlobal.__revitSupabaseAppStateRegistered = true;
  }
}
