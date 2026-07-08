import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dcService } from "./api";
import { DcFormValues, DcStatus, DcType } from "./types";

const KEY = "delivery-challans";

export function useDcs(params: {
  page: number;
  type: DcType | "all";
  status: DcStatus | "all";
  search: string;
}) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => dcService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useDc(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => dcService.getById(id!),
    enabled: !!id,
  });
}

export function useDcOrderInfo(orderId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "order-info", orderId],
    queryFn: () => dcService.orderInfo(orderId!),
    enabled: !!orderId,
  });
}

export function useDcMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["elastics"] }); // DC_OUT reduces elastic stock
  };

  const create = useMutation({
    mutationFn: (body: DcFormValues) => dcService.create(body),
    onSuccess: invalidate,
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DcStatus }) =>
      dcService.updateStatus(id, status),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => dcService.remove(id),
    onSuccess: invalidate,
  });
  return { create, updateStatus, remove };
}
