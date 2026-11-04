import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateEntityInput,
  createEntity,
  deleteEntity,
  getEntity,
  getEntityCategories,
  searchEntities,
} from "@/api/entities";
import { submitResourceWithRecovery } from "@/services/creation/submit-resource-with-recovery";
import { queryKeys } from "@/lib/query/query-keys";

export function useEntityCategories() {
  return useQuery({
    queryKey: queryKeys.entities.categories(),
    queryFn: ({ signal }) => getEntityCategories(signal),
    staleTime: 300_000,
  });
}

export function useEntity(id: string) {
  return useQuery({
    enabled: id.length > 0,
    queryKey: queryKeys.entities.byId(id),
    queryFn: ({ signal }) => getEntity(id, signal),
  });
}

export function useEntitySearch(query: string, category?: string) {
  const term = query.trim();
  return useQuery({
    enabled: term.length >= 2,
    queryKey: queryKeys.entities.search(term.toLowerCase(), category),
    queryFn: ({ signal }) => searchEntities(term, category, signal),
  });
}

export function useCreateEntity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEntityInput) =>
      submitResourceWithRecovery(input.authorId, "FIND", input.attempt, () =>
        createEntity(input),
      ),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.entities.all }),
        client.invalidateQueries({ queryKey: queryKeys.discover.all }),
      ]),
  });
}

export function useDeleteEntity(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deleteEntity(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.entities.all }),
        client.invalidateQueries({ queryKey: queryKeys.shares.all }),
        client.invalidateQueries({ queryKey: queryKeys.feed.all }),
        client.invalidateQueries({ queryKey: queryKeys.discover.all }),
      ]);
    },
  });
}
