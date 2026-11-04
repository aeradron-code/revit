import { useQuery } from "@tanstack/react-query";

import { discover } from "@/api/discover";
import { queryKeys } from "@/lib/query/query-keys";

export function useDiscover(query: string, viewerId: string) {
  const searchTerm = query.trim();

  return useQuery({
    enabled: viewerId.length > 0 && searchTerm.length >= 2,
    queryFn: ({ signal }) => discover(searchTerm, signal),
    queryKey: queryKeys.discover.search(searchTerm.toLowerCase(), viewerId),
  });
}
