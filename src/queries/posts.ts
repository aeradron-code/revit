import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createAskPost,
  createForumAskPost,
  createForumSharePost,
  deletePost,
  getAskPostsByAuthor,
  getPost,
  type PostPage,
  type UpdateAskPostInput,
  updateAskPost,
} from "@/api/posts";
import type { LocalImage } from "@/lib/media/read-local-image";
import { queryKeys } from "@/lib/query/query-keys";
import { runAskCreationWithRecovery } from "@/services/creation/submit-ask-with-recovery";

export type CreateAskPostMutationInput = {
  authorId: string;
  body?: string;
  images: LocalImage[];
  attempt: import("@/api/posts").AskCreationAttempt;
};

export function useCreateAskPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAskPostMutationInput) => {
      return runAskCreationWithRecovery(input, "ASK", createAskPost);
    },
    onSuccess: (post) => {
      queryClient.removeQueries({
        queryKey: queryKeys.posts.byIdPrefix(post.id),
      });
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.posts.byAuthor(post.author_id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
      ]);
    },
  });
}

export function useCreateForumAskPost(forumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateAskPostMutationInput & { forumId: string },
    ) =>
      runAskCreationWithRecovery(input, "FORUM_ASK", (prepared) =>
        createForumAskPost({ ...input, ...prepared }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.forums.postsByForum(forumId),
      }),
  });
}

export function useCreateForumSharePost(forumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateAskPostMutationInput & {
        entityId: string;
        forumId: string;
        score: number;
      },
    ) =>
      runAskCreationWithRecovery(input, "FORUM_SHARE", (prepared) =>
        createForumSharePost({ ...input, ...prepared }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.forums.postsByForum(forumId),
      }),
  });
}

export function usePost(postId: string, viewerId: string) {
  return useQuery({
    enabled: postId.length > 0 && viewerId.length > 0,
    queryFn: ({ signal }) => getPost(postId, signal),
    queryKey: queryKeys.posts.byId(postId, viewerId),
  });
}

export function useAskPostsByAuthor(authorId: string) {
  return useInfiniteQuery({
    enabled: authorId.length > 0,
    getNextPageParam: (lastPage: PostPage) => lastPage.nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getAskPostsByAuthor(authorId, pageParam, signal),
    queryKey: queryKeys.posts.byAuthor(authorId),
  });
}

export function useUpdateAskPost(postId: string, authorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAskPostInput) => updateAskPost(postId, input),
    onSuccess: (post) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.posts.byIdPrefix(postId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.posts.byAuthor(authorId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
      ];
      if (post.forum_id) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.forums.postsByForum(post.forum_id),
          }),
        );
      }
      return Promise.all(invalidations);
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePost,
    onSuccess: async (_result, postId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.posts.byIdPrefix(postId),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.forums.postsAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shares.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ratings.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        }),
      ]);
    },
  });
}
