import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coveringService, warpingService } from "./api";
import { ProgrammeStatus } from "./types";

const WARP_KEY = "warpings";
const COVER_KEY = "coverings";
const BATCH_KEY = "warping-batches";

export function useWarpings(params: { status: ProgrammeStatus | "all"; search: string; page: number }) {
  return useQuery({
    queryKey: [WARP_KEY, params],
    queryFn: () => warpingService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useWarping(id: string | undefined) {
  return useQuery({
    queryKey: [WARP_KEY, "detail", id],
    queryFn: () => warpingService.getById(id!),
    enabled: !!id,
  });
}

export function useWarpingPlan(warpingId: string | undefined) {
  return useQuery({
    queryKey: [WARP_KEY, "plan", warpingId],
    queryFn: () => warpingService.getPlan(warpingId!),
    enabled: !!warpingId,
  });
}

export function usePlanContext(jobId: string | undefined) {
  return useQuery({
    queryKey: [WARP_KEY, "plan-context", jobId],
    queryFn: () => warpingService.planContext(jobId!),
    enabled: !!jobId,
  });
}

export function useWarpYarnOptions(jobId: string | undefined) {
  const ctx = usePlanContext(jobId);
  return { ...ctx, data: ctx.data?.warpYarns };
}

export function useWarpingMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [WARP_KEY] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const start = useMutation({ mutationFn: warpingService.start, onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: ({ id, forceReason }: { id: string; forceReason?: string }) =>
      warpingService.complete(id, forceReason ? { forceReason } : undefined),
    onSuccess: invalidate,
  });
  const cancel = useMutation({ mutationFn: warpingService.cancel, onSuccess: invalidate });
  const createPlan = useMutation({
    mutationFn: warpingService.createPlan,
    onSuccess: invalidate,
  });
  const deletePlan = useMutation({
    mutationFn: ({ planId, auditReason }: { planId: string; auditReason: string }) =>
      warpingService.deletePlan(planId, auditReason),
    onSuccess: invalidate,
  });
  return { start, complete, cancel, createPlan, deletePlan };
}

export function useWarpingBatches(warpingId: string | undefined) {
  return useQuery({
    queryKey: [BATCH_KEY, warpingId],
    queryFn: () => warpingService.batches(warpingId!),
    enabled: !!warpingId,
  });
}

export function useBatchMutations() {
  const qc = useQueryClient();
  // Issuing draws yarn off a lot, so the material pages and lot pickers
  // are stale too — not just the batch list.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [BATCH_KEY] });
    qc.invalidateQueries({ queryKey: ["yarn-lots"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
  };
  const create = useMutation({ mutationFn: warpingService.createBatch, onSuccess: invalidate });
  const issue = useMutation({ mutationFn: warpingService.issueBatch, onSuccess: invalidate });
  const complete = useMutation({ mutationFn: warpingService.completeBatch, onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: warpingService.cancelBatch, onSuccess: invalidate });
  return { create, issue, complete, cancel };
}

export function useCoverings(params: { status: ProgrammeStatus | "all"; search: string; page: number }) {
  return useQuery({
    queryKey: [COVER_KEY, params],
    queryFn: () => coveringService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCovering(id: string | undefined) {
  return useQuery({
    queryKey: [COVER_KEY, "detail", id],
    queryFn: () => coveringService.getById(id!),
    enabled: !!id,
  });
}

export function useCoveringMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [COVER_KEY] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const start = useMutation({ mutationFn: coveringService.start, onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      coveringService.complete(id, remarks),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      coveringService.cancel(id, remarks),
    onSuccess: invalidate,
  });
  const addBeam = useMutation({
    mutationFn: ({ id, beamNo, weight, note }: { id: string; beamNo: number; weight: number; note?: string }) =>
      coveringService.addBeamEntry(id, beamNo, weight, note),
    onSuccess: invalidate,
  });
  const deleteBeam = useMutation({
    mutationFn: ({ coveringId, entryId }: { coveringId: string; entryId: string }) =>
      coveringService.deleteBeamEntry(coveringId, entryId),
    onSuccess: invalidate,
  });
  return { start, complete, cancel, addBeam, deleteBeam };
}
