import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { machineService } from "./api";
import { MachineFormValues, MachineStatus, ServiceLogFormValues } from "./types";

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
    onSuccess: invalidate,
  });
  const addServiceLog = useMutation({
    mutationFn: ({ machineId, body }: { machineId: string; body: ServiceLogFormValues }) =>
      machineService.addServiceLog(machineId, body),
    onSuccess: invalidate,
  });
  return { create, setStatus, addServiceLog };
}
