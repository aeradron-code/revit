import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // API reads own bounded retries; avoid retrying them again at query level.
      retry: false,
      staleTime: 30_000,
    },
    mutations: {
      // Writes retry only when their API operation explicitly supports it.
      retry: false,
    },
  },
});
