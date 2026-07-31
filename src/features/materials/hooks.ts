import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { materialService } from "./api";
import { MaterialFormValues } from "./types";

const KEY = "materials";
const LOT_KEY = "yarn-lots";

export function useMaterials(params: { search: string; category: string; lowStock: boolean }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => materialService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useReplenishmentForecast(horizonDays: number, lookbackDays = 30) {
  return useQuery({
    queryKey: [KEY, "forecast", horizonDays, lookbackDays],
    queryFn: () => materialService.replenishmentForecast(horizonDays, lookbackDays),
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
  return { create, setStatus };
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
  const remove = useMutation({
    mutationFn: (id: string) => materialService.remove(id),
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
  return { create, update, remove, adjustStock };
}
