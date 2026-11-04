import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPersonalPick,
  deletePersonalPick,
  getFollowedPickIds,
  getPersonalPick,
  getPersonalPicksByAuthor,
  getPicksFromFollowing,
  type SavePersonalPickInput,
  setPickFollow,
  updatePersonalPick,
} from "@/api/picks";
import { queryKeys } from "@/lib/query/query-keys";

export function usePersonalPick(pickId: string) {
  return useQuery({
    enabled: pickId.length > 0,
    queryFn: ({ signal }) => getPersonalPick(pickId, signal),
    queryKey: queryKeys.picks.byId(pickId),
  });
}

export function usePersonalPicksByAuthor(authorId: string) {
  return useQuery({
    enabled: authorId.length > 0,
    queryFn: ({ signal }) => getPersonalPicksByAuthor(authorId, signal),
    queryKey: queryKeys.picks.byAuthor(authorId),
  });
}

export function useCreatePersonalPick(authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPersonalPick,
    onSuccess: (pick) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.picks.byAuthor(authorId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.picks.byId(pick.id),
        }),
      ]),
  });
}

export function useUpdatePersonalPick(pickId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SavePersonalPickInput) =>
      updatePersonalPick(pickId, input),
    onSuccess: (pick) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.picks.byAuthor(authorId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.picks.byId(pick.id),
        }),
      ]),
  });
}

export function useDeletePersonalPick(pickId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deletePersonalPick(pickId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.picks.byId(pickId) });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.picks.byAuthor(authorId),
      });
    },
  });
}

export function usePicksFromFollowing(userId: string) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: queryKeys.picks.followingDirectory(userId),
    queryFn: ({ signal }) => getPicksFromFollowing(userId, signal),
  });
}

export function useFollowedPicks(userId: string) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: queryKeys.picks.followed(userId),
    queryFn: ({ signal }) => getFollowedPickIds(userId, signal),
  });
}

export function useTogglePickFollow(userId: string, pickId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (follow: boolean) => setPickFollow(userId, pickId, follow),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.picks.followed(userId) }),
  });
}
