import {
  lookupResourceCreation,
  type ResourceCreationKind,
} from "@/api/creation-recovery";
import {
  lookupAskCreation,
  lookupPostCreation,
  type AskCreationLookup,
  type IdempotentPostKind,
} from "@/api/posts";
import {
  askRecoveryStore,
  postRecoveryStores,
  resourceRecoveryStores,
} from "./ask-recovery-store";

export async function loadAskRecovery(userId: string) {
  return askRecoveryStore.load(userId);
}

export async function loadPostRecovery(
  userId: string,
  kinds: readonly IdempotentPostKind[],
) {
  for (const kind of kinds) {
    const operationId = await postRecoveryStores[kind].load(userId);
    if (operationId) return { kind, operationId };
  }
  return null;
}

export async function loadResourceRecovery(
  userId: string,
  kind: ResourceCreationKind,
) {
  return resourceRecoveryStores[kind].load(userId);
}

export async function resolveAskRecovery(
  userId: string,
  operationId: string,
  signal?: AbortSignal,
): Promise<AskCreationLookup> {
  const result = await lookupAskCreation(operationId, signal);
  if (result.status === "confirmed") {
    await clearExpected(askRecoveryStore, userId, operationId);
  }
  return result;
}

export async function discardAskRecovery(userId: string, operationId: string) {
  await clearExpected(askRecoveryStore, userId, operationId);
}

export async function resolvePostRecovery(
  userId: string,
  operationId: string,
  kind: IdempotentPostKind,
): Promise<AskCreationLookup> {
  const result = await lookupPostCreation(operationId, kind);
  if (result.status === "confirmed") {
    await clearExpected(postRecoveryStores[kind], userId, operationId);
  }
  return result;
}

export async function discardPostRecovery(
  userId: string,
  operationId: string,
  kind: IdempotentPostKind,
) {
  await clearExpected(postRecoveryStores[kind], userId, operationId);
}

export async function resolveResourceRecovery(
  userId: string,
  operationId: string,
  kind: ResourceCreationKind,
) {
  const resourceId = await lookupResourceCreation(operationId, kind);
  if (resourceId) {
    await clearExpected(resourceRecoveryStores[kind], userId, operationId);
  }
  return resourceId;
}

export async function discardResourceRecovery(
  userId: string,
  operationId: string,
  kind: ResourceCreationKind,
) {
  await clearExpected(resourceRecoveryStores[kind], userId, operationId);
}

async function clearExpected(
  store: {
    clearIfMatches(userId: string, operationId: string): Promise<boolean>;
  },
  userId: string,
  operationId: string,
) {
  if (!(await store.clearIfMatches(userId, operationId))) {
    throw new Error("Saved creation recovery changed before it was cleared.");
  }
}
