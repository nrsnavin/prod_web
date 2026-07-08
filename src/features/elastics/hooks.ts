import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { elasticService } from "./api";
import { ElasticFormValues } from "./types";

const KEY = "elastics";

export function useElastics(params: { page: number; search: string }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => elasticService.list({ ...params, limit: 20 }),
    placeholderData: (prev) => prev,
  });
}

export function useElastic(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => elasticService.getById(id!),
    enabled: !!id,
  });
}

export function useMaterialsByCategory() {
  return useQuery({
    queryKey: ["materials-by-category"],
    queryFn: elasticService.materialsByCategory,
    staleTime: 5 * 60_000,
  });
}

export function useElasticMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: ElasticFormValues) => elasticService.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ElasticFormValues }) =>
      elasticService.update(id, body),
    onSuccess: invalidate,
  });
  const recalculate = useMutation({
    mutationFn: (id: string) => elasticService.recalculateCost(id),
    onSuccess: invalidate,
  });
  return { create, update, recalculate };
}
