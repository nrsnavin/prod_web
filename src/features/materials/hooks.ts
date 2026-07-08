import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { materialService } from "./api";
import { MaterialFormValues } from "./types";

const KEY = "materials";

export function useMaterials(params: { search: string; category: string; lowStock: boolean }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => materialService.list(params),
    placeholderData: (prev) => prev,
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
    mutationFn: ({ id, adjustment, reason }: { id: string; adjustment: number; reason: string }) =>
      materialService.adjustStock(id, adjustment, reason),
    onSuccess: invalidate,
  });
  return { create, update, remove, adjustStock };
}
