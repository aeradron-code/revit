type Draft = { score: number | null; body: string };
type DirtyFields = { score: boolean; body: boolean };

export function canPublishShare({
  signedIn,
  hasEntity,
  score,
  saving,
  ratingLookupSucceeded,
  ratingLookupFailed,
}: {
  signedIn: boolean;
  hasEntity: boolean;
  score: number | null;
  saving: boolean;
  ratingLookupSucceeded: boolean;
  ratingLookupFailed: boolean;
}): boolean {
  return (
    signedIn &&
    hasEntity &&
    score !== null &&
    !saving &&
    ratingLookupSucceeded &&
    !ratingLookupFailed
  );
}

export function initializeShareDraft(
  current: Draft,
  saved: { score: number; body: string | null } | null,
  dirty: DirtyFields,
): Draft {
  return {
    score: dirty.score ? current.score : (saved?.score ?? null),
    body: dirty.body ? current.body : (saved?.body ?? ""),
  };
}
