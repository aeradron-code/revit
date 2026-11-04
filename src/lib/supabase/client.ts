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

const developmentGlobal = globalThis as DevelopmentGlobal;

function createSupabaseClient(url: string, key: string) {
  return createClient<Database>(url, key, {
    auth: {
      flowType: "pkce",
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
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
