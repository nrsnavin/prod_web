import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "./api";
import { AnalyticsFilters } from "./types";

export function useAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", filters],
    queryFn: () => analyticsService.getAnalytics(filters),
    placeholderData: (prev) => prev, // keep charts up while refetching a new range
  });
}
