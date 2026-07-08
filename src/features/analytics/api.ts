import { httpClient } from "@/core/http/httpClient";
import { ApiEnvelope } from "@/core/api/types";
import { AnalyticsData, AnalyticsFilters } from "./types";

export const analyticsService = {
  async getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsData> {
    const res = await httpClient.get<ApiEnvelope<AnalyticsData>>(
      "/production/analytics",
      { ...filters }
    );
    return res.data;
  },
};
