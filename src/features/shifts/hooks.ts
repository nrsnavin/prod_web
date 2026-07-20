import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productionService, shiftService } from "./api";
import { ShiftPlanFormValues } from "./types";

const KEY = "shifts";

export function useTodayShifts() {
  return useQuery({ queryKey: [KEY, "today"], queryFn: shiftService.today });
}

export function useShiftPlan(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "plan", id],
    queryFn: () => shiftService.planById(id!),
    enabled: !!id,
  });
}

export function usePlansOnDate(dateIso: string) {
  return useQuery({
    queryKey: [KEY, "on-date", dateIso],
    queryFn: () => shiftService.plansOnDate(dateIso),
  });
}

export function usePendingVerification() {
  return useQuery({
    queryKey: [KEY, "pending-verification"],
    queryFn: shiftService.pendingVerification,
  });
}

export function useRunningMachines(enabled = true) {
  return useQuery({
    queryKey: ["machines", "running"],
    queryFn: shiftService.runningMachines,
    enabled,
  });
}

export function useWeavingEmployees(enabled = true) {
  return useQuery({
    queryKey: ["employees", "weaving"],
    queryFn: shiftService.weavingEmployees,
    enabled,
  });
}

export function useShiftMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["production"] });
  };
  const createPlan = useMutation({
    mutationFn: (body: ShiftPlanFormValues) => shiftService.createPlan(body),
    onSuccess: invalidate,
  });
  const deletePlan = useMutation({
    mutationFn: (id: string) => shiftService.deletePlan(id),
    onSuccess: invalidate,
  });
  const verify = useMutation({
    mutationFn: shiftService.verifyProduction,
    onSuccess: invalidate,
  });
  return { createPlan, deletePlan, verify };
}

export function useProductionRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["production", "range", startDate, endDate],
    queryFn: () => productionService.dateRange(startDate, endDate),
    placeholderData: (prev) => prev,
  });
}

export function useProductionShiftDetail(shiftPlanId: string | undefined) {
  return useQuery({
    queryKey: ["production", "shift-detail", shiftPlanId],
    queryFn: () => productionService.shiftDetail(shiftPlanId!),
    enabled: !!shiftPlanId,
  });
}
