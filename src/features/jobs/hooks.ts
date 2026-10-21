import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jobService, ChangeElasticBody } from "./api";
import { JobStatus } from "./types";

const KEY = "jobs";

export function useJobs(params: { page: number; status: JobStatus | "all"; search: string }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => jobService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => jobService.getById(id!),
    enabled: !!id,
  });
}

/** The order's elastics as candidates for a mid-run change; fetched only while the dialog is open. */
export function useJobOrderElastics(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [KEY, "order-elastics", id],
    queryFn: () => jobService.orderElastics(id!),
    enabled: !!id && enabled,
  });
}

export function useJobSummary(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "summary", id],
    queryFn: () => jobService.summary(id!),
    enabled: !!id,
  });
}

// Only meaningful while the job is still preparatory, so callers pass
// `enabled` rather than the hook guessing from a status it doesn't hold.
export function useWeavingReadiness(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [KEY, "weaving-readiness", id],
    queryFn: () => jobService.weavingReadiness(id!),
    enabled: !!id && enabled,
  });
}

export function useMrp(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "mrp", id],
    queryFn: () => jobService.mrp(id!),
    enabled: !!id,
  });
}

export function useJobYarnLots(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "yarn-lots", id],
    queryFn: () => jobService.yarnLots(id!),
    enabled: !!id,
  });
}

export function useJobPurchaseOrders(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "purchase-orders", id],
    queryFn: () => jobService.jobPurchaseOrders(id!),
    enabled: !!id,
  });
}

export function useRaisePo(jobId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { materials?: string[]; expectedDate?: string; notes?: string }) =>
      jobService.raisePo(jobId!, body),
    // Raising a PO changes what is on order for the job, and adds rows to
    // the purchase-order list elsewhere in the app.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "purchase-orders", jobId] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useJobMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["machines"] });
  };

  const create = useMutation({
    mutationFn: (body: {
      orderId: string;
      date: string;
      elastics: Array<{ elastic: string; quantity: number }>;
    }) => jobService.create(body),
    onSuccess: invalidate,
  });
  const planWeaving = useMutation({
    mutationFn: ({
      jobId,
      machineId,
      headElasticMap,
      loading,
      confirmHooks,
    }: {
      jobId: string;
      machineId: string;
      headElasticMap: Record<string, string | null>;
      loading?: boolean;
      /** Go ahead despite an elastic needing more hooks than the machine has. */
      confirmHooks?: boolean;
    }) => jobService.planWeaving(jobId, machineId, headElasticMap, confirmHooks, loading),
    onSuccess: invalidate,
  });
  const updateElastics = useMutation({
    mutationFn: ({
      jobId,
      elastics,
      auditReason,
      expectedVersion,
    }: {
      jobId: string;
      elastics: Array<{ elastic: string; quantity: number }>;
      auditReason: string;
      expectedVersion?: number;
    }) => jobService.updateElastics(jobId, elastics, auditReason, expectedVersion),
    onSuccess: invalidate,
  });
  const changeElastic = useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: ChangeElasticBody }) => jobService.changeElastic(jobId, body),
    onSuccess: () => {
      invalidate();
      // The loom's head map and its open shifts follow the change.
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  const updateStatus = useMutation({
    mutationFn: ({ jobId, nextStatus }: { jobId: string; nextStatus: JobStatus }) =>
      jobService.updateStatus(jobId, nextStatus),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason?: string }) =>
      jobService.cancel(jobId, reason),
    onSuccess: invalidate,
  });
  const setProductionMode = useMutation({
    mutationFn: ({
      jobId,
      mode,
      vendor,
    }: {
      jobId: string;
      mode: "in_house" | "outsource";
      vendor?: string;
    }) => jobService.setProductionMode(jobId, mode, vendor),
    onSuccess: invalidate,
  });
  return { create, planWeaving, updateElastics, changeElastic, updateStatus, cancel, setProductionMode };
}
