import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createForum,
  deleteForum,
  getForum,
  getForums,
  joinForum,
  leaveForum,
} from "@/api/forums";
import { getForumPosts, type PostPage } from "@/api/posts";
import { submitResourceWithRecovery } from "@/services/creation/submit-resource-with-recovery";
import { queryKeys } from "@/lib/query/query-keys";

export function useForums(viewerId: string) {
  return useQuery({
    enabled: viewerId.length > 0,
    queryFn: ({ signal }) => getForums(signal),
    queryKey: queryKeys.forums.list(viewerId),
  });
}

export function useCreateForum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createForum>[0]) =>
      submitResourceWithRecovery(input.ownerId, "FORUM", input.attempt, () =>
        createForum(input),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.forums.all }),
  });
}

export function useDeleteForum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteForum,
    onSuccess: async (_data, forumId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.forums.byIdPrefix(forumId),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.forums.postsByForum(forumId),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.forums.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ratings.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shares.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        }),
      ]);
    },
  });
}

export function useForum(forumId: string, userId: string) {
  return useQuery({
    enabled: forumId.length > 0 && userId.length > 0,
    queryFn: ({ signal }) => getForum(forumId, signal),
    queryKey: queryKeys.forums.byId(forumId, userId),
  });
}

export function useForumPosts(forumId: string, userId: string) {
  return useInfiniteQuery<
    PostPage,
    Error,
    InfiniteData<PostPage>,
    ReturnType<typeof queryKeys.forums.posts>,
    number
  >({
    enabled: forumId.length > 0 && userId.length > 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getForumPosts(forumId, pageParam, signal),
    queryKey: queryKeys.forums.posts(forumId, userId),
  });
}

export function useForumMembership(forumId: string, userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shouldJoin: boolean) =>
      shouldJoin ? joinForum(forumId, userId) : leaveForum(forumId, userId),
    onSuccess: (_data, shouldJoin) => {
      const refreshes = [
        queryClient.invalidateQueries({ queryKey: queryKeys.forums.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.forums.byId(forumId, userId),
        }),
      ];
      if (shouldJoin) {
        refreshes.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.forums.posts(forumId, userId),
          }),
        );
      } else {
        queryClient.removeQueries({
          queryKey: queryKeys.forums.posts(forumId, userId),
        });
      }
      return Promise.all(refreshes);
    },
  });
}
