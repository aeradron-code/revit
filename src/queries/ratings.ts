import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteAskRating,
  getAskRatingSummary,
  getMyAskRating,
  type Rating,
  type RatingSummary,
  saveAskRating,
} from "@/api/ratings";
import { queryKeys } from "@/lib/query/query-keys";

export function useMyAskRating(postId: string, raterId: string) {
  return useQuery({
    enabled: postId.length > 0 && raterId.length > 0,
    queryFn: ({ signal }) => getMyAskRating(postId, raterId, signal),
    queryKey: queryKeys.ratings.mine(postId, raterId),
  });
}

export function useAskRatingSummary(
  postId: string,
  viewerId: string,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && postId.length > 0 && viewerId.length > 0,
    queryFn: ({ signal }) => getAskRatingSummary(postId, signal),
    queryKey: queryKeys.ratings.summary(postId, viewerId),
  });
}

export function useSetMyAskRating(postId: string, raterId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.ratings.mine(postId, raterId);
  const summaryQueryKey = queryKeys.ratings.summary(postId, raterId);

  return useMutation({
    mutationFn: (score: number | null) =>
      score === null
        ? deleteAskRating(postId, raterId).then(() => null)
        : saveAskRating(postId, raterId, score),
    onMutate: async (score) => {
      await Promise.all([
        queryClient.cancelQueries({ exact: true, queryKey }),
        queryClient.cancelQueries({ exact: true, queryKey: summaryQueryKey }),
      ]);
      const previous = queryClient.getQueryData<Rating | null>(queryKey);
      const previousSummary =
        queryClient.getQueryData<RatingSummary>(summaryQueryKey);

      if (score === null) {
        queryClient.setQueryData(queryKey, null);
      } else {
        const now = new Date().toISOString();
        queryClient.setQueryData<Rating>(queryKey, {
          created_at: previous?.created_at ?? now,
          post_id: postId,
          rater_id: raterId,
          score,
          updated_at: now,
        });
      }

      if (previousSummary) {
        queryClient.setQueryData(
          summaryQueryKey,
          updateRatingSummary(previousSummary, previous?.score ?? null, score),
        );
      }

      return { previous, previousSummary };
    },
    onError: (_error, _score, context) => {
      if (context?.previous === undefined) {
        queryClient.removeQueries({ exact: true, queryKey });
      } else {
        queryClient.setQueryData(queryKey, context.previous);
      }

      if (context?.previousSummary === undefined) {
        queryClient.removeQueries({ exact: true, queryKey: summaryQueryKey });
      } else {
        queryClient.setQueryData(summaryQueryKey, context.previousSummary);
      }
    },
    onSuccess: (rating) => {
      queryClient.setQueryData(queryKey, rating);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ exact: true, queryKey }),
        queryClient.invalidateQueries({
          exact: true,
          queryKey: summaryQueryKey,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.forums.postsAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
      ]),
  });
}

function updateRatingSummary(
  summary: RatingSummary,
  previousScore: number | null,
  nextScore: number | null,
): RatingSummary {
  const previousTotal = (summary.averageScore ?? 0) * summary.ratingCount;

  if (previousScore === null && nextScore !== null) {
    const ratingCount = summary.ratingCount + 1;
    return {
      averageScore: (previousTotal + nextScore) / ratingCount,
      ratingCount,
    };
  }

  if (previousScore !== null && nextScore === null) {
    const ratingCount = Math.max(0, summary.ratingCount - 1);
    return {
      averageScore:
        ratingCount === 0
          ? null
          : (previousTotal - previousScore) / ratingCount,
      ratingCount,
    };
  }

  if (previousScore !== null && nextScore !== null) {
    return {
      averageScore:
        (previousTotal - previousScore + nextScore) / summary.ratingCount,
      ratingCount: summary.ratingCount,
    };
  }

  return summary;
}
