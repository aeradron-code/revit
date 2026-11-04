export function shouldAutoMarkRead({
  unreadKey,
  lastAutoAttempt,
  pending,
  failed,
}: {
  unreadKey: string | null;
  lastAutoAttempt: string | null;
  pending: boolean;
  failed: boolean;
}): boolean {
  return Boolean(
    unreadKey && unreadKey !== lastAutoAttempt && !pending && !failed,
  );
}
