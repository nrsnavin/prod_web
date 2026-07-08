import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderService } from "./api";
import { OrderFormValues, OrderStatus } from "./types";

const KEY = "orders";

export function useOrders(status: OrderStatus) {
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
    mutationFn: (id: string) => orderService.approve(id),
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
  return { create, approve, cancel, startProduction, complete };
}
