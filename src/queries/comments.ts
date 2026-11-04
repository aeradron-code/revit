import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  type CommentPage,
  createReply,
  createTopLevelComment,
  deleteComment,
  getCommentCount,
  getTopLevelComments,
  updateComment,
} from "@/api/comments";
import { queryKeys } from "@/lib/query/query-keys";

function invalidateCommentAndListData(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.comments.byPostPrefix(postId),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.forums.postsAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
  ]);
}

export function useCommentCount(
  postId: string,
  viewerId: string,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && postId.length > 0 && viewerId.length > 0,
    queryFn: ({ signal }) => getCommentCount(postId, signal),
    queryKey: queryKeys.comments.count(postId, viewerId),
  });
}

type TopLevelCommentsOptions = {
  pageSize?: number;
  viewerId: string;
};

export function useTopLevelComments(
  postId: string,
  { pageSize, viewerId }: TopLevelCommentsOptions,
) {
  return useInfiniteQuery({
    enabled: postId.length > 0 && viewerId.length > 0,
    getNextPageParam: (lastPage: CommentPage) => lastPage.nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getTopLevelComments(postId, pageParam, pageSize, signal),
    queryKey: pageSize
      ? queryKeys.comments.inlineByPost(postId, viewerId, pageSize)
      : queryKeys.comments.byPost(postId, viewerId),
  });
}

export function useCreateTopLevelComment(postId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) =>
      createTopLevelComment({ authorId, body, postId }),
    onSuccess: () => invalidateCommentAndListData(queryClient, postId),
  });
}

export function useCreateReply(postId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId: string }) =>
      createReply({ authorId, body, parentId, postId }),
    onSuccess: () => invalidateCommentAndListData(queryClient, postId),
  });
}

export function useUpdateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, commentId }: { body: string; commentId: string }) =>
      updateComment(commentId, body),
    onSuccess: () => invalidateCommentAndListData(queryClient, postId),
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => invalidateCommentAndListData(queryClient, postId),
  });
}
