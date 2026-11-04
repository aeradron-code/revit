import type {
  AskCreationAttempt,
  AskImageUpload,
  IdempotentPostKind,
  Post,
} from "@/api/posts";
import type { LocalImage } from "@/lib/media/read-local-image";
import { prepareAskAttemptImages } from "@/lib/media/read-local-image";
import { askRecoveryStore, postRecoveryStores } from "./ask-recovery-store";

type Input = {
  authorId: string;
  body?: string;
  images: LocalImage[];
  attempt: AskCreationAttempt;
};

type Dependencies = {
  prepare(
    attempt: AskCreationAttempt,
    images: LocalImage[],
  ): Promise<AskImageUpload[]>;
  save(userId: string, operationId: string): Promise<void>;
  clear(userId: string, operationId: string): Promise<boolean>;
  create(input: {
    authorId: string;
    body?: string;
    images: AskImageUpload[];
    attempt: AskCreationAttempt;
  }): Promise<Post>;
};

type RecoveryScope = "ASK" | IdempotentPostKind;

type Create = (input: {
  authorId: string;
  body?: string;
  images: AskImageUpload[];
  attempt: AskCreationAttempt;
}) => Promise<Post>;

/** Own image preparation and local recovery persistence for every Ask creation flow. */
export function runAskCreationWithRecovery(
  input: Input,
  scope: RecoveryScope,
  create: Create,
): Promise<Post> {
  const store = scope === "ASK" ? askRecoveryStore : postRecoveryStores[scope];
  return submitAskWithRecovery(input, {
    prepare: prepareAskAttemptImages,
    save: store.save,
    clear: store.clearIfMatches,
    create,
  });
}

export async function submitAskWithRecovery(
  input: Input,
  deps: Dependencies,
): Promise<Post> {
  const images = await deps.prepare(input.attempt, input.images);
  const operationId = input.attempt.id;
  await deps.save(input.authorId, operationId);
  try {
    const post = await deps.create({ ...input, images });
    // A failed cleanup must not turn a confirmed creation into a failed write.
    try {
      await deps.clear(input.authorId, operationId);
    } catch {
      /* The stored ID can be reconciled later. */
    }
    return post;
  } catch (error) {
    if (!input.attempt.outcomeUncertain) {
      try {
        await deps.clear(input.authorId, operationId);
      } catch {
        /* Keep the original error. */
      }
    }
    throw error;
  }
}
