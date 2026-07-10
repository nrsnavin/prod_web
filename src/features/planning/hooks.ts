import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plannerService } from "./api";

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
    mutationFn: plannerService.accept,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "latest"] }),
  });
}
