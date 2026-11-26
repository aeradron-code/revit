import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const secureStoreStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const browserMemory = new Map<string, string>();
const browserStorage = {
  getItem: async (key: string) => browserMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    browserMemory.set(key, value);
  },
  removeItem: async (key: string) => {
    browserMemory.delete(key);
  },
};

/** Native sessions use encrypted storage; the web auth client is memory-only. */
export const authStorage =
  Platform.OS === "ios" || Platform.OS === "android"
    ? secureStoreStorage
    : browserStorage;
