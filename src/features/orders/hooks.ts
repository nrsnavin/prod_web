import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderService } from "./api";
import { OrderFilter, OrderFormValues } from "./types";

const KEY = "orders";

// Entry-time ETA estimate. Pass an already-debounced payload; the query
// stays disabled until there is at least one line with a positive qty.
export function useOrderEstimate(
  body: { elasticOrdered: Array<{ elastic: string; quantity: number }>; supplyDate?: string; machines?: number } | null,
  enabled = true
) {
  const valid = !!body && body.elasticOrdered.length > 0;
  return useQuery({
    queryKey: ["order-eta", body],
    queryFn: () => orderService.estimateCompletion(body!),
    enabled: enabled && valid,
    staleTime: 30_000,
    retry: false,
  });
}

export function useOrders(status: OrderFilter) {
  return useQuery({
    queryKey: [KEY, status],
    queryFn: () => orderService.list(status),
    placeholderData: (prev) => prev,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => orderService.getById(id!),
    enabled: !!id,
  });
}

export function useOrderMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["materials"] }); // approve deducts stock
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };

  const create = useMutation({
    mutationFn: (body: OrderFormValues) => orderService.create(body),
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: ({ id, force, forceReason }: { id: string; force?: boolean; forceReason?: string }) =>
      orderService.approve(id, force, forceReason),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => orderService.cancel(id),
    onSuccess: invalidate,
  });
  const startProduction = useMutation({
    mutationFn: (id: string) => orderService.startProduction(id),
    onSuccess: invalidate,
  });
  const complete = useMutation({
    mutationFn: (id: string) => orderService.complete(id),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<OrderFormValues> & { auditReason: string; expectedVersion?: number } }) =>
      orderService.update(id, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id, auditReason }: { id: string; auditReason: string }) =>
      orderService.remove(id, auditReason),
    onSuccess: invalidate,
  });
  return { create, approve, cancel, startProduction, complete, update, remove };
}
