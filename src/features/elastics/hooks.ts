import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { elasticService } from "./api";
import { ElasticCreateBody, ElasticFormValues } from "./types";

const KEY = "elastics";

export function useElastics(params: { page: number; search: string; showInactive?: boolean; lowStock?: boolean }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () =>
      elasticService.list({
        page: params.page,
        search: params.search,
        limit: 20,
        ...(params.showInactive ? { includeArchived: "true" } : {}),
        ...(params.lowStock ? { lowStock: "true" } : {}),
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

/**
 * The materials the elastic form offers, by recipe slot.
 *
 * Under the "materials" key on purpose: every write to a material (add,
 * edit, clone, archive, bulk update, price update, a group renamed)
 * already invalidates ["materials"], so a material added a moment ago is
 * in the picker the next time it opens. This used to be its own
 * "materials-by-category" key that nothing invalidated, cached for five
 * minutes — a new material was missing from the elastic form until then.
 *
 * Re-fetched whenever a form using it opens, so a material someone else
 * added is there too; not polled while it stays open.
 */
export function useMaterialsByCategory() {
  return useQuery({
    queryKey: ["materials", "by-category"],
    queryFn: elasticService.materialsByCategory,
    staleTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchInterval: false,
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
    mutationFn: ({ id, body, expectedVersion }: { id: string; body: ElasticFormValues; expectedVersion?: number }) =>
      elasticService.update(id, body, expectedVersion),
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
  const bulkArchive = useMutation({
    mutationFn: ({ ids, archived }: { ids: string[]; archived: boolean }) => elasticService.bulkArchive(ids, archived),
    onSuccess: invalidate,
  });
  const bulkCosting = useMutation({
    mutationFn: ({ ids, change }: { ids: string[]; change: { conversionCost?: number; changePercent?: number } }) =>
      elasticService.bulkCosting(ids, change),
    onSuccess: invalidate,
  });
  const bulkMinStock = useMutation({
    mutationFn: ({ ids, minStock }: { ids: string[]; minStock: number }) => elasticService.bulkMinStock(ids, minStock),
    onSuccess: invalidate,
  });
  const bulkCopyTemplate = useMutation({
    mutationFn: ({ sourceId, ids, replace }: { sourceId: string; ids: string[]; replace: boolean }) =>
      elasticService.bulkCopyTemplate(sourceId, ids, replace),
    onSuccess: invalidate,
  });
  const bulkTesting = useMutation({
    mutationFn: ({ ids, params }: { ids: string[]; params: Parameters<typeof elasticService.bulkTesting>[1] }) =>
      elasticService.bulkTesting(ids, params),
    onSuccess: invalidate,
  });
  return {
    create, update, recalculate, setArchived, remove, saveTemplate,
    bulkArchive, bulkCosting, bulkMinStock, bulkCopyTemplate, bulkTesting,
  };
}
