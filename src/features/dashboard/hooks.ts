import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "./api";

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: dashboardService.getKpis,
  });
}

/**
 * The home screen's figures. Refreshed each minute: the server shares one
 * computation per role for thirty seconds, and the forecast behind
 * "orders at risk" doesn't move faster than that.
 */
export function useDashboardOverview(enabled = true) {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: dashboardService.getOverview,
    refetchInterval: 60_000,
    enabled,
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
