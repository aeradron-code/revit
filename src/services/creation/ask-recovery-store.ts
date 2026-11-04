import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function keyForUser(userId: string, prefix: string) {
  if (!UUID.test(userId)) throw new Error("Invalid recovery user ID");
  return `${prefix}_${userId}`;
}

type Coordinator = <T>(action: () => Promise<T>) => Promise<T>;

export function createAskRecoveryStore(
  storage: Storage,
  coordinate: Coordinator = (action) => action(),
  prefix = "ask_creation",
) {
  // Serialize operations within this store instance; platform storage has no CAS.
  let pending: Promise<void> = Promise.resolve();
  function locked<T>(action: () => Promise<T>): Promise<T> {
    const result = pending.then(() => coordinate(action));
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  return {
    async load(userId: string): Promise<string | null> {
      return locked(async () => {
        const value = await storage.getItem(keyForUser(userId, prefix));
        if (value !== null && !UUID.test(value))
          throw new Error("Invalid saved Ask operation ID");
        return value;
      });
    },
    async save(userId: string, operationId: string): Promise<void> {
      if (!UUID.test(operationId)) throw new Error("Invalid Ask operation ID");
      await locked(async () => {
        const existing = await storage.getItem(keyForUser(userId, prefix));
        if (existing !== null && existing !== operationId)
          throw new Error("Another Ask operation requires recovery");
        await storage.setItem(keyForUser(userId, prefix), operationId);
      });
    },
    async clearIfMatches(
      userId: string,
      operationId: string,
    ): Promise<boolean> {
      if (!UUID.test(operationId)) throw new Error("Invalid Ask operation ID");
      return locked(async () => {
        const key = keyForUser(userId, prefix);
        const current = await storage.getItem(key);
        if (current === null) return true;
        if (current !== operationId) return false;
        await storage.removeItem(key);
        return true;
      });
    },
  };
}

const nativeStorage: Storage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

function browserStore() {
  if (!globalThis.localStorage)
    throw new Error("Browser storage is unavailable");
  return globalThis.localStorage;
}

const browserStorage: Storage = {
  getItem: async (key) => browserStore().getItem(key),
  setItem: async (key, value) => browserStore().setItem(key, value),
  removeItem: async (key) => browserStore().removeItem(key),
};

export const askRecoveryStore = createAskRecoveryStore(
  Platform.OS === "web" ? browserStorage : nativeStorage,
  Platform.OS === "web" && typeof navigator !== "undefined" && navigator.locks
    ? (action) => navigator.locks.request("revit-ask-recovery", action)
    : undefined,
);

function postStore(prefix: string) {
  return createAskRecoveryStore(
    Platform.OS === "web" ? browserStorage : nativeStorage,
    Platform.OS === "web" && typeof navigator !== "undefined" && navigator.locks
      ? (action) => navigator.locks.request(`revit-${prefix}`, action)
      : undefined,
    prefix,
  );
}

export const postRecoveryStores = {
  FORUM_ASK: postStore("forum_ask_creation"),
  FORUM_SHARE: postStore("forum_share_creation"),
  GLOBAL_SHARE: postStore("global_share_creation"),
} as const;

export const resourceRecoveryStores = {
  FORUM: postStore("forum_creation"),
  FIND: postStore("find_creation"),
} as const;
