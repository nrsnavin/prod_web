import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coveringService, warpingService } from "./api";
import { ProgrammeStatus } from "./types";

const WARP_KEY = "warpings";
const COVER_KEY = "coverings";

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

export function useWarpYarnOptions(jobId: string | undefined) {
  return useQuery({
    queryKey: [WARP_KEY, "plan-context", jobId],
    queryFn: () => warpingService.planContext(jobId!),
    enabled: !!jobId,
  });
}

export function useWarpingMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [WARP_KEY] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const start = useMutation({ mutationFn: warpingService.start, onSuccess: invalidate });
  const complete = useMutation({ mutationFn: warpingService.complete, onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: warpingService.cancel, onSuccess: invalidate });
  const createPlan = useMutation({
    mutationFn: warpingService.createPlan,
    onSuccess: invalidate,
  });
  return { start, complete, cancel, createPlan };
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
  return { start, complete, cancel };
}
