import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plannerService } from "./api";
import type { MachinePlan, SuggestedPlan } from "./types";

const KEY = "planner";

export function useSuggestedPlan(horizonDays: number) {
  return useQuery({
    queryKey: [KEY, "suggest", horizonDays],
    queryFn: () => plannerService.suggest(horizonDays),
    staleTime: 60_000,
  });
}

export function useLatestPlan() {
  return useQuery({
    queryKey: [KEY, "latest"],
    queryFn: () => plannerService.latest(),
    staleTime: 60_000,
  });
}

export function useAcceptPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { plan: SuggestedPlan; edited?: MachinePlan[] }) =>
      plannerService.accept(v.plan, v.edited),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "latest"] });
      // An accepted edit may have moved the weights, and the panel that
      // shows them would otherwise keep reporting the old count.
      qc.invalidateQueries({ queryKey: [KEY, "weights"] });
    },
  });
}

export function usePlannerWeights() {
  return useQuery({
    queryKey: [KEY, "weights"],
    queryFn: () => plannerService.weights().then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useResetWeights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: plannerService.resetWeights,
    // The suggestion is invalidated too: resetting the objective changes
    // what the planner would propose, and leaving a plan on screen that
    // was scored under weights no longer in force is how somebody
    // accepts one objective believing it is another.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "weights"] });
      qc.invalidateQueries({ queryKey: [KEY, "suggest"] });
    },
  });
}
