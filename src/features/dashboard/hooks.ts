import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "./api";

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: dashboardService.getKpis,
  });
}

export function usePendingShiftCount(enabled = true) {
  return useQuery({
    queryKey: ["dashboard", "pendingShifts"],
    queryFn: dashboardService.getPendingShiftCount,
    // The endpoint is admin/production-gated; departments that can't
    // access it (e.g. finance) must not fire the call at all — a 403
    // would just noise up their dashboard.
    enabled,
  });
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ["dashboard", "announcements"],
    queryFn: dashboardService.getActiveAnnouncements,
  });
}
