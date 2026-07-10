import { httpClient } from "@/core/http/httpClient";
import { BreakdownParams, BreakdownResponse, BulkEta, DeliveryRisk, RunningEta } from "./types";

export const breakdownService = {
  async get(params: BreakdownParams): Promise<BreakdownResponse> {
    // Drop empty optional filters so the query string stays clean.
    const query: Record<string, string> = {
      start: params.start,
      end: params.end,
      groupBy: params.groupBy,
      shift: params.shift,
    };
    if (params.machineId) query.machineId = params.machineId;
    if (params.customerId) query.customerId = params.customerId;
    return httpClient.get<BreakdownResponse>("/production/breakdown", query);
  },

  async runningEtaBulk(orderIds: string[]): Promise<Record<string, BulkEta>> {
    const res = await httpClient.post<{ success: boolean; etas: Record<string, BulkEta> }>(
      "/order/running-eta-bulk",
      { orderIds }
    );
    return res.etas;
  },

  async runningEta(orderId: string): Promise<RunningEta & { orderNo?: number; status?: string }> {
    return httpClient.get<RunningEta & { orderNo?: number; status?: string }>(
      `/order/${orderId}/running-eta`
    );
  },

  async etaRisks(): Promise<{ count: number; risks: DeliveryRisk[] }> {
    return httpClient.get<{ success: boolean; count: number; risks: DeliveryRisk[] }>("/order/eta-risks");
  },
};
