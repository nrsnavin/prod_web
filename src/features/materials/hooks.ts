import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { materialService } from "./api";
import { MaterialFormValues } from "./types";

const KEY = "materials";
const LOT_KEY = "yarn-lots";

export function useMaterials(params: {
  search: string;
  /** A MaterialGroup id. Preferred — see materialService.list. */
  group?: string;
  /** A category NAME. Still accepted for callers that have not moved. */
  category?: string;
  lowStock: boolean;
  includeArchived?: boolean;
}) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => materialService.list(params),
    placeholderData: (prev) => prev,
  });
}

/**
 * @param coverDays how long an order should last once it arrives — the
 *                  only thing a buyer now chooses, since the reorder
 *                  point comes from the supplier's measured lead time.
 */
export function useReplenishmentForecast(
  coverDays: number,
  lookbackDays = 60,
  serviceLevel = 95,
  includeHealthy = false
) {
  return useQuery({
    queryKey: [KEY, "forecast", coverDays, lookbackDays, serviceLevel, includeHealthy],
    queryFn: () =>
      materialService.replenishmentForecast(coverDays, lookbackDays, serviceLevel, includeHealthy),
    staleTime: 60_000,
  });
}

export function useMaterial(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => materialService.getById(id!),
    enabled: !!id,
  });
}

export function useSupplierOptions() {
  return useQuery({
    queryKey: ["supplier-options"],
    queryFn: () => materialService.supplierOptions(),
    staleTime: 5 * 60_000,
  });
}

export function useYarnLots(params: {
  material?: string;
  issuable?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [LOT_KEY, params.material, params.issuable],
    queryFn: () =>
      materialService.lots({ material: params.material, issuable: params.issuable }),
    enabled: params.enabled !== false && !!params.material,
  });
}

export function useLotTrace(id: string | undefined) {
  return useQuery({
    queryKey: [LOT_KEY, "trace", id],
    queryFn: () => materialService.traceLot(id!),
    enabled: !!id,
  });
}

export function useLotMutations() {
  const qc = useQueryClient();
  // A lot move changes the material detail page too — its Lots panel is
  // served by the material query, not the lot one.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [LOT_KEY] });
    qc.invalidateQueries({ queryKey: [KEY] });
  };

  const create = useMutation({
    mutationFn: (body: Parameters<typeof materialService.createLot>[0]) =>
      materialService.createLot(body),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: ({
      id,
      status,
      remarks,
    }: {
      id: string;
      status: "open" | "quarantined" | "closed";
      remarks?: string;
    }) => materialService.setLotStatus(id, status, remarks),
    onSuccess: invalidate,
  });
  const adjust = useMutation({
    mutationFn: ({ id, delta, reason }: { id: string; delta: number; reason: string }) =>
      materialService.adjustLot(id, { delta, reason }),
    onSuccess: invalidate,
  });
  return { create, setStatus, adjust };
}

/**
 * One lot with its own ledger.
 *
 * Fetched only when a row is expanded — the ledger is select:false on
 * the server and there is no reason to drag every lot's history into a
 * list nobody has opened.
 */
export function useLot(id: string | undefined) {
  return useQuery({
    queryKey: [LOT_KEY, "detail", id],
    queryFn: () => materialService.lot(id!),
    enabled: !!id,
  });
}

export function useMaterialMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: MaterialFormValues) => materialService.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: MaterialFormValues }) =>
      materialService.update(id, body),
    onSuccess: invalidate,
  });
  // Resolves with what the server actually did — deleted, or archived
  // because the material is in use. The caller reads that rather than
  // assuming, so a screen never reports a deletion that did not happen.
  const remove = useMutation({
    mutationFn: (id: string) => materialService.remove(id),
    onSuccess: invalidate,
  });
  const setArchived = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      materialService.setArchived(id, archived),
    onSuccess: invalidate,
  });
  const adjustStock = useMutation({
    mutationFn: ({
      id,
      adjustment,
      reason,
      lotNo,
      shade,
      yarnLot,
    }: {
      id: string;
      adjustment: number;
      reason: string;
      lotNo?: string;
      shade?: string;
      yarnLot?: string;
    }) => materialService.adjustStock(id, adjustment, reason, { lotNo, shade, yarnLot }),
    // An adjustment that names a lot moves the lot ledger too, so the
    // lot queries are stale as well as the material ones.
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: [LOT_KEY] });
    },
  });
  return { create, update, remove, setArchived, adjustStock };
}
