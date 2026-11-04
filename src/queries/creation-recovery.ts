import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ResourceCreationKind } from "@/api/creation-recovery";
import type { IdempotentPostKind } from "@/api/posts";
import { queryKeys } from "@/lib/query/query-keys";
import {
  discardAskRecovery,
  discardPostRecovery,
  discardResourceRecovery,
  loadAskRecovery,
  loadPostRecovery,
  loadResourceRecovery,
  resolveAskRecovery,
  resolvePostRecovery,
  resolveResourceRecovery,
} from "@/services/creation/recovery-actions";

const recoveryQueryOptions = {
  retry: false,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

export function useAskRecovery(userId: string) {
  return useQuery({
    ...recoveryQueryOptions,
    enabled: userId.length > 0,
    queryKey: queryKeys.recovery.ask(userId),
    queryFn: () => loadAskRecovery(userId),
    staleTime: Infinity,
  });
}

export function usePostRecovery(
  userId: string,
  kinds: readonly IdempotentPostKind[],
) {
  return useQuery({
    ...recoveryQueryOptions,
    enabled: userId.length > 0 && kinds.length > 0,
    queryKey: queryKeys.recovery.posts(userId, kinds),
    queryFn: () => loadPostRecovery(userId, kinds),
  });
}

export function useResourceRecovery(
  userId: string,
  kind: ResourceCreationKind,
) {
  return useQuery({
    ...recoveryQueryOptions,
    enabled: userId.length > 0,
    queryKey: queryKeys.recovery.resources(userId, kind),
    queryFn: () => loadResourceRecovery(userId, kind),
  });
}

export function useResolveAskRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      operationId,
      signal,
    }: {
      userId: string;
      operationId: string;
      signal?: AbortSignal;
    }) => resolveAskRecovery(userId, operationId, signal),
    onSuccess: (result, input) =>
      result.status === "confirmed"
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.recovery.ask(input.userId),
          })
        : undefined,
  });
}

export function useDiscardAskRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; operationId: string }) =>
      discardAskRecovery(input.userId, input.operationId),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.recovery.ask(input.userId),
      }),
  });
}

export function useResolvePostRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      operationId: string;
      kind: IdempotentPostKind;
    }) => resolvePostRecovery(input.userId, input.operationId, input.kind),
    onSuccess: (result, input) =>
      result.status === "confirmed"
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.recovery.postsByUser(input.userId),
          })
        : undefined,
  });
}

export function useDiscardPostRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      operationId: string;
      kind: IdempotentPostKind;
    }) => discardPostRecovery(input.userId, input.operationId, input.kind),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.recovery.postsByUser(input.userId),
      }),
  });
}

export function useResolveResourceRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      operationId: string;
      kind: ResourceCreationKind;
    }) => resolveResourceRecovery(input.userId, input.operationId, input.kind),
    onSuccess: (resourceId, input) =>
      resourceId
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.recovery.resources(input.userId, input.kind),
          })
        : undefined,
  });
}

export function useDiscardResourceRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      operationId: string;
      kind: ResourceCreationKind;
    }) => discardResourceRecovery(input.userId, input.operationId, input.kind),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.recovery.resources(input.userId, input.kind),
      }),
  });
}
