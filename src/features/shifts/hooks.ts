import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productionService, shiftService } from "./api";
import { PendingShift, ShiftPlanFormValues } from "./types";
import { withoutShift } from "./pendingList";

const KEY = "shifts";

/** Day/night summary. No date = today; pass one to browse another day. */
export function useShiftDay(dateIso?: string) {
  return useQuery({
    queryKey: [KEY, "day", dateIso ?? "today"],
    queryFn: () => shiftService.today(dateIso),
  });
}

export function useTodayShifts() {
  return useShiftDay();
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

    // ── The third repeated action ───────────────────────────────────
    //  A supervisor works down the pending list one row at a time.
    //  Waiting a round trip for each row before it disappears makes a
    //  queue of twenty feel like work; the row going the moment it is
    //  verified makes it feel like ticking things off.
    //
    //  Only the pending LIST is guessed. The shift's own figures, the
    //  dashboard and the production view are refetched, because
    //  verifying rewrites numbers this client cannot compute.
    onMutate: async ({ shiftId }) => {
      const key = [KEY, "pending-verification"];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ count: number; shifts: PendingShift[] }>(key);
      if (!previous) return { previous };

      qc.setQueryData(key, withoutShift(previous, shiftId));
      return { previous };
    },

    // Put the row back. A verification that failed but left the row
    // gone is the worst outcome: a shift nobody checked, looking
    // exactly like one somebody did.
    onError: (_e, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData([KEY, "pending-verification"], ctx.previous);
      }
    },

    onSettled: invalidate,
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
