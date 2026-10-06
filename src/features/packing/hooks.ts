import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { packingService } from "./api";
import { PackingFormValues } from "./types";
import { useRequestId } from "@/core/hooks/useRequestId";

const KEY = "packing";

export function usePackingGrouped() {
  return useQuery({ queryKey: [KEY, "grouped"], queryFn: packingService.grouped });
}

export function usePackingByJob(jobId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "by-job", jobId],
    queryFn: () => packingService.byJob(jobId!),
    enabled: !!jobId,
  });
}

export function usePackingJobs() {
  return useQuery({ queryKey: [KEY, "jobs"], queryFn: packingService.jobsPacking });
}

export function useEmployeesByDept(dept: string) {
  return useQuery({
    queryKey: ["employees-by-dept", dept],
    queryFn: () => packingService.employeesByDept(dept),
    staleTime: 5 * 60_000,
  });
}

export function usePackingMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  // A resend of the same packing is the same packing, not a second one.
  const ids = useRequestId();
  const create = useMutation({
    mutationFn: (body: PackingFormValues) => packingService.create({ ...body, requestId: ids.for(body) }),
    onSuccess: () => {
      ids.done();
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { meter: number; auditReason: string } }) =>
      packingService.update(id, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id, auditReason }: { id: string; auditReason: string }) =>
      packingService.remove(id, auditReason),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
