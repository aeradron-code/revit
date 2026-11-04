import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  type CreateShareRatingInput,
  createShareRating,
  getEntityRatingSummary,
  getMyEntityRating,
  getSharePostsForEntity,
  getShareRatingScore,
  type SharePostPage,
  updateShareRating,
} from "@/api/shares";
import type { LocalImage } from "@/lib/media/read-local-image";
import { queryKeys } from "@/lib/query/query-keys";
import { runAskCreationWithRecovery } from "@/services/creation/submit-ask-with-recovery";

export type CreateShareRatingMutationInput = Omit<
  CreateShareRatingInput,
  "images"
> & {
  images: LocalImage[];
};

export function useMyEntityRating(entityId: string, authorId: string) {
  return useQuery({
    enabled: entityId.length > 0 && authorId.length > 0,
    queryFn: ({ signal }) => getMyEntityRating(entityId, authorId, signal),
    queryKey: queryKeys.shares.mine(entityId, authorId),
  });
}

export function useEntityRatingSummary(entityId: string) {
  return useQuery({
    enabled: entityId.length > 0,
    queryFn: ({ signal }) => getEntityRatingSummary(entityId, signal),
    queryKey: queryKeys.shares.summary(entityId),
  });
}

export function useShareRatingScore(postId: string, viewerId: string) {
  return useQuery({
    enabled: postId.length > 0 && viewerId.length > 0,
    queryFn: ({ signal }) => getShareRatingScore(postId, signal),
    queryKey: queryKeys.shares.score(postId, viewerId),
  });
}

export function useSharePostsByEntity(entityId: string) {
  return useInfiniteQuery<
    SharePostPage,
    Error,
    InfiniteData<SharePostPage>,
    ReturnType<typeof queryKeys.shares.byEntity>,
    number
  >({
    enabled: entityId.length > 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getSharePostsForEntity(entityId, pageParam, signal),
    queryKey: queryKeys.shares.byEntity(entityId),
  });
}

export function useCreateShareRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShareRatingMutationInput) => {
      return runAskCreationWithRecovery(input, "GLOBAL_SHARE", (prepared) =>
        createShareRating({ ...input, ...prepared }),
      );
    },
    onSuccess: (post, input) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.shares.mine(input.entityId, input.authorId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.shares.summary(input.entityId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.shares.byEntity(input.entityId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.posts.byIdPrefix(post.id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
      ]),
  });
}

export function useUpdateShareRating(
  postId: string,
  entityId: string,
  authorId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body?: string; score: number }) =>
      updateShareRating(postId, input),
    onSuccess: (post) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.shares.mine(entityId, authorId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.shares.summary(entityId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.shares.byEntity(entityId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.shares.scoreByPostPrefix(post.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.posts.byIdPrefix(post.id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
      ]),
  });
}
