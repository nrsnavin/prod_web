import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/core/http/httpClient";
import { machineService } from "./api";
import {
  Machine,
  MachineDetailsPatch,
  MachineFormValues,
  MachineStatus,
  ServiceBillUpload,
  ServiceLogFormValues,
} from "./types";

const KEY = "machines";

export function useMachines(status: MachineStatus | "all") {
  return useQuery({
    queryKey: [KEY, status],
    queryFn: () => machineService.list(status),
    placeholderData: (prev) => prev,
  });
}

export function useMachine(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => machineService.getById(id!),
    enabled: !!id,
  });
}

/** Every service/spare bill on the machine, grouped by log at the call site. */
export function useServiceBills(machineId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "service-bills", machineId],
    queryFn: () => machineService.serviceBills(machineId!),
    enabled: !!machineId,
  });
}

export function useMaintenanceDue(days = 14) {
  return useQuery({
    queryKey: [KEY, "maintenance-due", days],
    queryFn: () => machineService.maintenanceDue(days),
  });
}

/** Plant-wide service spending and the patterns worth a look. */
export function useServiceAnalytics(days = 365) {
  return useQuery({
    queryKey: [KEY, "service-analytics", days],
    queryFn: () => machineService.serviceAnalytics(days),
  });
}

export function useMachineSpend(machineId: string | undefined, days = 365) {
  return useQuery({
    queryKey: [KEY, "spend", machineId, days],
    queryFn: () => machineService.machineSpend(machineId!, days),
    enabled: !!machineId,
  });
}

export function useProductionSeries(machineId: string | undefined, days = 365) {
  return useQuery({
    queryKey: [KEY, "production-series", machineId, days],
    queryFn: () => machineService.productionSeries(machineId!, days),
    enabled: !!machineId,
  });
}

// ══════════════════════════════════════════════════════════════════
//  A 404 ON A WRITE MEANS THE PAGE IS SHOWING SOMETHING THAT IS GONE
//
//  This app does not refetch on window focus (App.tsx), which is the
//  right call for a screen somebody leaves open on a shop floor all
//  day — but it means a tab can go on rendering a machine long after
//  the record has left the database, and every button on it still
//  works as far as the browser is concerned.
//
//  That is not hypothetical. Attaching a bill returned "no machine has
//  id …" from a page that was, at that moment, displaying the machine,
//  its service history and an Attach bill button. The page had loaded
//  correctly; the record was removed underneath it afterwards.
//
//  So a 404 from a WRITE is treated as news about the world rather
//  than as a rejected request: drop the cache and re-read. The detail
//  query then fails too, and the page shows "Machine not found"
//  instead of a machine that is not there. The user learns what
//  actually happened rather than being told to try again.
//
//  Only 404. A 400 or a 409 means the record is fine and the request
//  was wrong, and refetching on those buys nothing.
// ══════════════════════════════════════════════════════════════════
export function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function useMachineMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  /** Re-read when the server says the record no longer exists. */
  const refetchIfGone = (error: unknown) => {
    if (isGone(error)) invalidate();
  };

  const create = useMutation({
    mutationFn: (body: MachineFormValues) => machineService.create(body),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "free" | "maintenance" }) =>
      machineService.setStatus(id, status),

    // ── Repeated enough to earn a guess ─────────────────────────────
    //  Taking looms off the floor and putting them back is done a row
    //  at a time, often several in a row, and the chip is the only
    //  thing that says whether it worked. Waiting a round trip for each
    //  makes a supervisor click twice.
    //
    //  Only the list is updated optimistically. The detail page is left
    //  to the server, because it shows the running job alongside the
    //  status and guessing that a job vanished would be inventing a
    //  fact rather than anticipating one.
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: [KEY] });
      const snapshots = qc.getQueriesData<Machine[]>({ queryKey: [KEY] });

      for (const [key, rows] of snapshots) {
        if (!Array.isArray(rows)) continue;
        qc.setQueryData<Machine[]>(
          key,
          rows.map((m) => (m._id === id ? { ...m, status } : m))
        );
      }
      return { snapshots };
    },

    // Every list this touched, back exactly as it was.
    onError: (_e, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) qc.setQueryData(key, data);
    },

    // Still refetch: a status move can change the running job too, and
    // that part was never guessed.
    onSettled: invalidate,
  });
  const addServiceLog = useMutation({
    mutationFn: ({ machineId, body }: { machineId: string; body: ServiceLogFormValues }) =>
      machineService.addServiceLog(machineId, body),
    onSuccess: invalidate,
    onError: refetchIfGone,
  });
  const updateElasticMap = useMutation({
    mutationFn: ({ id, elastics, confirmHooks }: {
      id: string;
      elastics: Array<{ head: number; elastic: string | null }>;
      /** Go ahead despite an elastic needing more hooks than the machine has. */
      confirmHooks?: boolean;
    }) => machineService.updateElasticMap(id, elastics, confirmHooks),
    onSuccess: invalidate,
    onError: refetchIfGone,
  });
  const updateHeads = useMutation({
    mutationFn: ({ id, noOfHead }: { id: string; noOfHead: number }) =>
      machineService.updateHeads(id, noOfHead),
    onSuccess: invalidate,
    onError: refetchIfGone,
  });
  const updateDetails = useMutation({
    mutationFn: ({ id, patch, confirmHooks }: {
      id: string;
      patch: MachineDetailsPatch;
      /** Go ahead despite stranding an elastic already on the loom. */
      confirmHooks?: boolean;
    }) => machineService.updateDetails(id, patch, confirmHooks),
    onSuccess: invalidate,
    onError: refetchIfGone,
  });
  const dismissFinding = useMutation({
    mutationFn: ({ kind, subject, reason }: {
      kind: string; subject: string; reason: string;
    }) => machineService.dismissFinding(kind, subject, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "service-analytics"] }),
  });
  const uploadServiceBill = useMutation({
    mutationFn: (payload: ServiceBillUpload) => machineService.uploadServiceBill(payload),
    onSuccess: invalidate,
    onError: refetchIfGone,
  });
  const deleteServiceBill = useMutation({
    mutationFn: (id: string) => machineService.deleteServiceBill(id),
    onSuccess: invalidate,
    onError: refetchIfGone,
  });
  return {
    create,
    setStatus,
    addServiceLog,
    updateElasticMap,
    updateHeads,
    updateDetails,
    dismissFinding,
    uploadServiceBill,
    deleteServiceBill,
  };
}
