import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { slipService, SlipFilter } from "./api";
import { Shift, Slip, SlipEdit } from "./types";

const KEY = "production-slips";

/** Still being read: worth asking again shortly. */
export const isReading = (s?: Pick<Slip, "status"> | null) =>
  s?.status === "received" || s?.status === "reading";

export function useSlips(status: SlipFilter, page: number) {
  return useQuery({
    queryKey: [KEY, "list", status, page],
    queryFn: () => slipService.list(status, page),
    placeholderData: (prev) => prev,
    // A slip sent on WhatsApp shows up here without a reload.
    refetchInterval: (q) => (q.state.data?.slips.some(isReading) ? 4_000 : 30_000),
  });
}

export function useSlip(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => slipService.get(id!),
    enabled: !!id,
    refetchInterval: (q) => (isReading(q.state.data) ? 4_000 : false),
  });
}

export function useSlipMutations() {
  const qc = useQueryClient();
  const settle = (slip?: Slip) => {
    if (slip) qc.setQueryData([KEY, "detail", slip.id], slip);
    qc.invalidateQueries({ queryKey: [KEY, "list"] });
  };
  const upload = useMutation({
    mutationFn: (v: { files: File[]; caption?: string; dateKey?: string; shift?: Shift | "" }) =>
      slipService.upload(v.files, v),
    onSuccess: (slip) => settle(slip),
  });
  const setShift = useMutation({
    mutationFn: (v: { id: string; dateKey: string; shift: Shift }) => slipService.setShift(v.id, v.dateKey, v.shift),
    onSuccess: (slip) => settle(slip),
  });
  const apply = useMutation({
    mutationFn: (v: { id: string; rows: SlipEdit[]; version: number }) => slipService.apply(v.id, v.rows, v.version),
    onSuccess: (out) => {
      settle(out.slip);
      // Submitted entries now wait on the verification screen.
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
  const discard = useMutation({
    mutationFn: (id: string) => slipService.discard(id),
    onSuccess: (slip) => settle(slip),
  });
  return { upload, setShift, apply, discard };
}
