import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { elasticService } from "./api";
import { ElasticCreateBody, ElasticFormValues } from "./types";

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

/**
 * The orders that asked for this elastic, one page at a time.
 *
 * Paged rather than infinite-scrolled: the two lists sit side by side on
 * the detail page, and a page you can step back through is easier to
 * hold a place in than a list that only grows. `placeholderData` keeps
 * the previous page on screen while the next loads, so paging does not
 * blank the panel.
 */
export function useElasticOrders(id: string | undefined, page: number, limit = 10) {
  return useQuery({
    queryKey: [KEY, "orders", id, page, limit],
    queryFn: () => elasticService.orders(id!, { page, limit }),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
}

/** The jobs that made it, same paging. */
export function useElasticJobs(id: string | undefined, page: number, limit = 10) {
  return useQuery({
    queryKey: [KEY, "jobs", id, page, limit],
    queryFn: () => elasticService.jobs(id!, { page, limit }),
    enabled: !!id,
    placeholderData: (prev) => prev,
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
    mutationFn: (body: ElasticCreateBody) => elasticService.create(body),
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
