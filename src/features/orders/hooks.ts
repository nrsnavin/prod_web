import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/**
 * Orders for a status, one page at a time.
 *
 * /order/list is paginated — it used to return every order ever placed —
 * so this walks pages on demand rather than assuming one response is the
 * whole set. `orders` is what has been loaded so far; `total` is how many
 * match, so a screen can say "showing 200 of 340" honestly instead of
 * quietly presenting a truncated list as complete.
 */
export function useOrders(status: OrderFilter, limit = 200) {
  const query = useInfiniteQuery({
    queryKey: [KEY, status, limit],
    queryFn: ({ pageParam }) => orderService.list(status, { page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });

  const pages = query.data?.pages ?? [];
  return {
    ...query,
    orders: pages.flatMap((p) => p.orders),
    total: pages[0]?.total ?? 0,
  };
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


export function useOrderMrp(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "mrp", id],
    queryFn: () => orderService.mrp(id!),
    enabled: !!id,
  });
}

export function useOrderPurchaseOrders(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "purchase-orders", id],
    queryFn: () => orderService.purchaseOrders(id!),
    enabled: !!id,
  });
}

export function useOrderRaisePo(orderId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { materials?: string[]; expectedDate?: string; notes?: string }) =>
      orderService.raisePo(orderId!, body),
    // The order's own PO list and the global one both go stale, and so
    // does the MRP — buying does not change the requirement, but it
    // changes what is on order against it.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "purchase-orders", orderId] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}
