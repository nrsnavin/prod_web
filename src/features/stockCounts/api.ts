import { httpClient } from "@/core/http/httpClient";
import {
  CountEntry,
  StockCount,
  StockCountScope,
  StockCountStatus,
  StockCountSummary,
  VarianceReport,
} from "./types";

const ROOT = "/stock-counts";

export const stockCountService = {
  async list(params: { status?: StockCountStatus | "all"; page?: number; limit?: number } = {}) {
    const query: Record<string, unknown> = {};
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;
    return httpClient.get<{
      success: boolean;
      counts: StockCountSummary[];
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    }>(ROOT, query);
  },

  async getById(id: string): Promise<StockCount> {
    const res = await httpClient.get<{ success: boolean; count: StockCount }>(`${ROOT}/${id}`);
    return res.count;
  },

  async open(body: { label: string; scope: StockCountScope }): Promise<StockCount> {
    const res = await httpClient.post<{ success: boolean; count: StockCount }>(ROOT, body);
    return res.count;
  },

  /**
   * Enter counted quantities. Lines not mentioned are left exactly as
   * they were, so two people counting different racks never wipe each
   * other's work — which is why this sends only what changed.
   */
  async enter(id: string, lines: CountEntry[]) {
    return httpClient.patch<{
      success: boolean;
      status: StockCountStatus;
      applied: Array<{ lineId: string; countedQty: number | null }>;
      errors?: Array<{ ref: string; error: string }>;
      count: StockCount;
    }>(`${ROOT}/${id}/lines`, { lines });
  },

  /**
   * Apply the differences. `force` is needed only when some lines were
   * never counted — those are left untouched, not written off.
   */
  async post(id: string, force = false): Promise<StockCount> {
    const res = await httpClient.post<{ success: boolean; count: StockCount }>(
      `${ROOT}/${id}/post`,
      { force }
    );
    return res.count;
  },

  async cancel(id: string, reason: string): Promise<StockCount> {
    const res = await httpClient.post<{ success: boolean; count: StockCount }>(
      `${ROOT}/${id}/cancel`,
      { reason }
    );
    return res.count;
  },

  variance(id: string, only: "varied" | "all" = "varied"): Promise<VarianceReport> {
    return httpClient.get<VarianceReport>(`${ROOT}/${id}/variance`, { only });
  },
};
