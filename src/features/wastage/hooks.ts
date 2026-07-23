import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { wastageService } from "./api";
import { WastageFormValues } from "./types";

const KEY = "wastage";

export function useWastageJobs(search: string) {
  return useQuery({
    queryKey: [KEY, "jobs", search],
    queryFn: () => wastageService.jobsWithWastage(search || undefined),
    placeholderData: (prev) => prev,
  });
}

export function useWastageByJob(jobId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "by-job", jobId],
    queryFn: () => wastageService.byJob(jobId!),
    enabled: !!jobId,
  });
}

export function useEligibleJobs(enabled = true) {
  return useQuery({
    queryKey: [KEY, "eligible-jobs"],
    queryFn: wastageService.eligibleJobs,
    enabled,
  });
}

export function useJobOperators(jobId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "job-operators", jobId],
    queryFn: () => wastageService.jobOperators(jobId!),
    enabled: !!jobId,
  });
}

export function useWastageAnalytics(days: number) {
  return useQuery({
    queryKey: [KEY, "analytics", days],
    queryFn: () => wastageService.analytics(days),
  });
}

export function useWastageRootCause(days: number) {
  return useQuery({
    queryKey: [KEY, "root-cause", days],
    queryFn: () => wastageService.rootCause(days),
  });
}

export function useWastageMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const add = useMutation({
    mutationFn: (body: WastageFormValues) => wastageService.add(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { quantity?: number; penalty?: number; reason?: string; auditReason: string } }) =>
      wastageService.update(id, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id, auditReason }: { id: string; auditReason: string }) =>
      wastageService.remove(id, auditReason),
    onSuccess: invalidate,
  });
  return { add, update, remove };
}
