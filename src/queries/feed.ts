import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import {
  getHomeFeed,
  type HomeFeedCursor,
  type HomeFeedMode,
  type HomeFeedPage,
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
