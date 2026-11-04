import type {
  ResourceCreationAttempt,
  ResourceCreationKind,
} from "@/api/creation-recovery";
import { resourceRecoveryStores } from "./ask-recovery-store";

export async function submitResourceWithRecovery<T>(
  userId: string,
  kind: ResourceCreationKind,
  attempt: ResourceCreationAttempt,
  create: () => Promise<T>,
): Promise<T> {
  const operationId = attempt.id;
  const store = resourceRecoveryStores[kind];
  await store.save(userId, operationId);
  try {
    const result = await create();
    try {
      await store.clearIfMatches(userId, operationId);
    } catch {
      /* Confirmed creation remains successful. */
    }
    return result;
  } catch (error) {
    if (!attempt.outcomeUncertain) {
      try {
        await store.clearIfMatches(userId, operationId);
      } catch {
        /* Preserve the original error. */
      }
    }
    throw error;
  }
}
