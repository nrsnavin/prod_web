import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { elasticService } from "./api";
import { ElasticFormValues } from "./types";

const KEY = "elastics";

export function useElastics(params: { page: number; search: string; showInactive?: boolean }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () =>
      elasticService.list({
        page: params.page,
        search: params.search,
        limit: 20,
        ...(params.showInactive ? { includeArchived: "true" } : {}),
      }),
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
  const setArchived = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      elasticService.setArchived(id, archived),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => elasticService.remove(id),
    onSuccess: invalidate,
  });
  const saveTemplate = useMutation({
    mutationFn: ({ id, template }: { id: string; template?: ElasticFormValues["warpingPlanTemplate"] }) =>
      elasticService.saveWarpingTemplate(id, template),
    onSuccess: invalidate,
  });
  return { create, update, recalculate, setArchived, remove, saveTemplate };
}
