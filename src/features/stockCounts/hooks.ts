import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stockCountService } from "./api";
import { CountEntry, StockCountScope, StockCountStatus } from "./types";

const KEY = "stock-counts";

export function useStockCounts(params: { status: StockCountStatus | "all"; page: number }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => stockCountService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useStockCount(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => stockCountService.getById(id!),
    enabled: !!id,
  });
}

export function useVarianceReport(id: string | undefined, only: "varied" | "all") {
  return useQuery({
    queryKey: [KEY, "variance", id, only],
    queryFn: () => stockCountService.variance(id!, only),
    enabled: !!id,
  });
}

export function useStockCountMutations(id?: string) {
  const qc = useQueryClient();
  // Posting moves stock, so the material list and every material detail
  // page are stale afterwards. Invalidating them here rather than at each
  // call site is what stops a posted count leaving the Raw Materials
  // screen showing the pre-count figures.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["materials"] });
  };

  return {
    open: useMutation({
      mutationFn: (body: { label: string; scope: StockCountScope }) =>
        stockCountService.open(body),
      onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
    }),
    enter: useMutation({
      mutationFn: (lines: CountEntry[]) => stockCountService.enter(id!, lines),
      onSuccess: (res) => {
        // Write the server's copy straight into the cache. A refetch
        // would race the next keystroke and snap a half-typed row back
        // to its old value.
        qc.setQueryData([KEY, "detail", id], res.count);
        qc.invalidateQueries({ queryKey: [KEY, "variance", id] });
      },
    }),
    post: useMutation({
      mutationFn: (force: boolean) => stockCountService.post(id!, force),
      onSuccess: (count) => {
        qc.setQueryData([KEY, "detail", id], count);
        invalidate();
      },
    }),
    cancel: useMutation({
      mutationFn: (reason: string) => stockCountService.cancel(id!, reason),
      onSuccess: (count) => {
        qc.setQueryData([KEY, "detail", id], count);
        qc.invalidateQueries({ queryKey: [KEY] });
      },
    }),
  };
}
