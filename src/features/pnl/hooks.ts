import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { pnlService } from "./api";
import { CostSettings, JobCostOverrides, PnlSort } from "./types";

const KEY = "pnl";

export function usePnlOrders(params: {
  page?: number;
  limit?: number;
  sort?: PnlSort;
  status?: string;
} = {}) {
  return useQuery({
    queryKey: [KEY, "orders", params],
    queryFn: () => pnlService.orders(params),
    placeholderData: (prev) => prev,
  });
}

export function useOrderPnl(orderId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "order", orderId],
    queryFn: () => pnlService.byOrder(orderId!),
    enabled: !!orderId,
  });
}

export function useCostSettings() {
  return useQuery({ queryKey: [KEY, "settings"], queryFn: () => pnlService.settings() });
}

const message = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

/**
 * The three writes. Each invalidates the WHOLE p&l key rather than one
 * order: a rate-card change re-costs every order in the list, and showing
 * one refreshed row beside a dozen stale ones is worse than a reload.
 */
export function usePnlMutations(orderId?: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const done = (label: string) => () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    if (orderId) qc.invalidateQueries({ queryKey: ["order", orderId] });
    toast(label, "success");
  };

  return {
    saveRates: useMutation({
      mutationFn: (rates: Array<{ elastic: string; rate: number }>) =>
        pnlService.saveRates(orderId!, rates),
      onSuccess: done("Selling rates saved"),
      onError: (e) => toast(message(e, "Could not save the selling rates"), "error"),
    }),

    saveOverrides: useMutation({
      mutationFn: ({ jobId, body }: { jobId: string; body: JobCostOverrides }) =>
        pnlService.saveOverrides(jobId, body),
      onSuccess: done("Job cost saved"),
      onError: (e) => toast(message(e, "Could not save the job cost"), "error"),
    }),

    saveSettings: useMutation({
      mutationFn: (body: Partial<CostSettings>) => pnlService.saveSettings(body),
      onSuccess: done("Rate card saved"),
      onError: (e) => toast(message(e, "Could not save the rate card"), "error"),
    }),
  };
}
