import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { elasticGroupService } from "./api";
import { ElasticGroupFormValues } from "./types";

const KEY = "elastic-groups";

// Pass a customerId to get that customer's groups plus global bundles.
// Pass nothing for the full management list.
export function useElasticGroups(customerId?: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, customerId ?? "all"],
    queryFn: () => elasticGroupService.list(customerId),
    enabled,
    staleTime: 60_000,
  });
}

export function useElasticGroupMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: ElasticGroupFormValues) => elasticGroupService.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ElasticGroupFormValues }) =>
      elasticGroupService.update(id, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => elasticGroupService.remove(id),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
