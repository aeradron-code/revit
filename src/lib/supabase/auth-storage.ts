import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const secureStoreStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const browserStorage = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) =>
    globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
};

/** Native sessions are encrypted; web uses the browser's persistent storage. */
export const authStorage =
  Platform.OS === "ios" || Platform.OS === "android"
    ? secureStoreStorage
    : browserStorage;
