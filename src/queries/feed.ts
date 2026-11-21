import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import {
  getHomeFeed,
  getProfilePostsByAuthor,
  type HomeFeedCursor,
  type HomeFeedMode,
  type HomeFeedPage,
  type ProfilePostsPage,
} from "@/api/feed";
import { queryKeys } from "@/lib/query/query-keys";

export function useHomeFeed(viewerId: string, mode: HomeFeedMode) {
  const initialCursor: HomeFeedCursor | undefined = undefined;
  return useInfiniteQuery<
    HomeFeedPage,
    Error,
    InfiniteData<HomeFeedPage>,
    ReturnType<typeof queryKeys.feed.home>,
    HomeFeedCursor | undefined
  >({
    enabled: viewerId.length > 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: initialCursor,
    queryFn: ({ pageParam, signal }) => getHomeFeed(mode, pageParam, signal),
    queryKey: queryKeys.feed.home(viewerId, mode),
  });
}

export function useProfilePostsByAuthor(authorId: string) {
  return useInfiniteQuery<
    ProfilePostsPage,
    Error,
    InfiniteData<ProfilePostsPage>,
    ReturnType<typeof queryKeys.posts.byAuthor>,
    number
  >({
    enabled: authorId.length > 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getProfilePostsByAuthor(authorId, pageParam, signal),
    queryKey: queryKeys.posts.byAuthor(authorId),
  });
}
