import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stockCountService } from "./api";
import { applyCounts } from "./optimistic";
import { CountEntry, StockCount, StockCountScope, StockCountStatus } from "./types";

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

      // ── The one action people do hundreds of times ───────────────
      //  Somebody stands at a rack with a sheet of 200 lines and types
      //  a number into each. Every one of those used to wait for a
      //  round trip before the row moved, which on a phone at the far
      //  end of a shed is the difference between an interface that
      //  feels alive and one people describe as slow.
      //
      //  This is deliberately one of only a handful of optimistic
      //  mutations. It earns it by being repeated; a once-a-week action
      //  can keep waiting honestly.
      onMutate: async (lines) => {
        const key = [KEY, "detail", id];
        // Stop an in-flight refetch from landing on top of the guess.
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<StockCount>(key);
        if (previous) qc.setQueryData<StockCount>(key, applyCounts(previous, lines));
        return { previous };
      },

      // Put the sheet back exactly as it was. A failed entry that left
      // the guessed number on screen would be the worst outcome here —
      // a count nobody made, looking like one somebody did.
      onError: (_err, _lines, ctx) => {
        if (ctx?.previous) qc.setQueryData([KEY, "detail", id], ctx.previous);
      },

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
