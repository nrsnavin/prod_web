import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { poService, supplierService } from "./api";
import { PoFormValues, PoStatus, SupplierFormValues } from "./types";

const SUPPLIER_KEY = "suppliers";
const PO_KEY = "purchase-orders";

export function useSuppliers(params: { page: number; search: string }) {
  return useQuery({
    queryKey: [SUPPLIER_KEY, params],
    queryFn: () => supplierService.list({ ...params, limit: 20 }),
    placeholderData: (prev) => prev,
  });
}

export function useSupplierMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [SUPPLIER_KEY] });
    qc.invalidateQueries({ queryKey: ["supplier-options"] });
  };
  const create = useMutation({
    mutationFn: (body: SupplierFormValues) => supplierService.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SupplierFormValues }) =>
      supplierService.update(id, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => supplierService.remove(id),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export function usePurchaseOrders(params: {
  page: number;
  status: PoStatus | "all";
  search: string;
}) {
  return useQuery({
    queryKey: [PO_KEY, params],
    queryFn: () => poService.list({ ...params, limit: 20 }),
    placeholderData: (prev) => prev,
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: [PO_KEY, "detail", id],
    queryFn: () => poService.getById(id!),
    enabled: !!id,
  });
}

export function usePoMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [PO_KEY] });
    qc.invalidateQueries({ queryKey: ["materials"] }); // inward changes stock
  };
  const create = useMutation({
    mutationFn: (body: PoFormValues) => poService.create(body),
    onSuccess: invalidate,
  });
  const clone = useMutation({
    mutationFn: (id: string) => poService.clone(id),
    onSuccess: invalidate,
  });
  const inward = useMutation({
    mutationFn: ({
      poId,
      items,
    }: {
      poId: string;
      items: Array<{ rawMaterial: string; quantity: number; remarks?: string; lotNo?: string }>;
    }) => poService.inwardStock(poId, items),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { expectedDate?: string; notes?: string; auditReason: string } }) =>
      poService.update(id, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id, auditReason }: { id: string; auditReason: string }) =>
      poService.remove(id, auditReason),
    onSuccess: invalidate,
  });
  return { create, clone, inward, update, remove };
}
