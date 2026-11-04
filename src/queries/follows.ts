import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  type FollowPage,
  followProfile,
  getFollowers,
  getFollowing,
  getFollowStatus,
  unfollowProfile,
} from "@/api/follows";
import type { FollowCounts } from "@/api/profiles";
import { queryKeys } from "@/lib/query/query-keys";

export function useFollowStatus(followerId: string, followingId: string) {
  return useQuery({
    enabled:
      followerId.length > 0 &&
      followingId.length > 0 &&
      followerId !== followingId,
    queryFn: ({ signal }) => getFollowStatus(followerId, followingId, signal),
    queryKey: queryKeys.follows.status(followerId, followingId),
  });
}

export function useFollowList(
  profileId: string,
  kind: "followers" | "following",
) {
  return useInfiniteQuery({
    enabled: profileId.length > 0,
    getNextPageParam: (lastPage: FollowPage) => lastPage.nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      kind === "followers"
        ? getFollowers(profileId, pageParam, signal)
        : getFollowing(profileId, pageParam, signal),
    queryKey:
      kind === "followers"
        ? queryKeys.follows.followers(profileId)
        : queryKeys.follows.following(profileId),
  });
}

export function useFollowToggle(followerId: string, followingId: string) {
  const queryClient = useQueryClient();
  const statusKey = queryKeys.follows.status(followerId, followingId);
  const targetCountsKey = queryKeys.profiles.followCounts(followingId);
  const viewerCountsKey = queryKeys.profiles.followCounts(followerId);

  return useMutation({
    mutationFn: async (shouldFollow: boolean) => {
      if (!followerId || !followingId || followerId === followingId) {
        throw new Error("This follow action is not available.");
      }

      if (shouldFollow) {
        await followProfile(followerId, followingId);
      } else {
        await unfollowProfile(followerId, followingId);
      }

      return shouldFollow;
    },
    onMutate: async (shouldFollow) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: statusKey }),
        queryClient.cancelQueries({ queryKey: targetCountsKey }),
        queryClient.cancelQueries({ queryKey: viewerCountsKey }),
      ]);

      const previousStatus = queryClient.getQueryData<boolean>(statusKey);
      const previousTargetCounts =
        queryClient.getQueryData<FollowCounts>(targetCountsKey);
      const previousViewerCounts =
        queryClient.getQueryData<FollowCounts>(viewerCountsKey);
      const change = shouldFollow ? 1 : -1;

      queryClient.setQueryData(statusKey, shouldFollow);
      updateCount(queryClient, targetCountsKey, "followers", change);
      updateCount(queryClient, viewerCountsKey, "following", change);

      return { previousStatus, previousTargetCounts, previousViewerCounts };
    },
    onError: (_error, _shouldFollow, context) => {
      if (context?.previousStatus === undefined) {
        queryClient.removeQueries({ exact: true, queryKey: statusKey });
      } else {
        queryClient.setQueryData(statusKey, context.previousStatus);
      }
      queryClient.setQueryData(targetCountsKey, context?.previousTargetCounts);
      queryClient.setQueryData(viewerCountsKey, context?.previousViewerCounts);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: statusKey }),
        queryClient.invalidateQueries({ queryKey: targetCountsKey }),
        queryClient.invalidateQueries({ queryKey: viewerCountsKey }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.follows.followers(followingId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.follows.following(followerId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.feed.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.picks.followingDirectory(followerId),
        }),
      ]);
    },
  });
}

function updateCount(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  field: keyof FollowCounts,
  change: number,
) {
  queryClient.setQueryData<FollowCounts>(queryKey, (current) =>
    current
      ? { ...current, [field]: Math.max(0, current[field] + change) }
      : current,
  );
}
