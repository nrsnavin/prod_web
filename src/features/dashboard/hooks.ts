import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "./api";

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: dashboardService.getKpis,
    refetchInterval: 60_000, // keep floor numbers live
  });
}

export function usePendingShiftCount() {
  return useQuery({
    queryKey: ["dashboard", "pendingShifts"],
    queryFn: dashboardService.getPendingShiftCount,
    refetchInterval: 60_000,
  });
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ["dashboard", "announcements"],
    queryFn: dashboardService.getActiveAnnouncements,
  });
}
