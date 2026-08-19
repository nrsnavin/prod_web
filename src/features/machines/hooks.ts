import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useMachineMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

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
  });
  const updateElasticMap = useMutation({
    mutationFn: ({ id, elastics, confirmHooks }: {
      id: string;
      elastics: Array<{ head: number; elastic: string | null }>;
      /** Go ahead despite an elastic needing more hooks than the machine has. */
      confirmHooks?: boolean;
    }) => machineService.updateElasticMap(id, elastics, confirmHooks),
    onSuccess: invalidate,
  });
  const updateHeads = useMutation({
    mutationFn: ({ id, noOfHead }: { id: string; noOfHead: number }) =>
      machineService.updateHeads(id, noOfHead),
    onSuccess: invalidate,
  });
  const updateDetails = useMutation({
    mutationFn: ({ id, patch, confirmHooks }: {
      id: string;
      patch: MachineDetailsPatch;
      /** Go ahead despite stranding an elastic already on the loom. */
      confirmHooks?: boolean;
    }) => machineService.updateDetails(id, patch, confirmHooks),
    onSuccess: invalidate,
  });
  const uploadServiceBill = useMutation({
    mutationFn: (payload: ServiceBillUpload) => machineService.uploadServiceBill(payload),
    onSuccess: invalidate,
  });
  const deleteServiceBill = useMutation({
    mutationFn: (id: string) => machineService.deleteServiceBill(id),
    onSuccess: invalidate,
  });
  return {
    create,
    setStatus,
    addServiceLog,
    updateElasticMap,
    updateHeads,
    updateDetails,
    uploadServiceBill,
    deleteServiceBill,
  };
}
