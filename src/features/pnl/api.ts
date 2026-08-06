import { httpClient } from "@/core/http/httpClient";
import { config } from "@/app/config";
import {
  CostSettings,
  JobCostOverrides,
  OrderPnl,
  PnlListPage,
  PnlSort,
} from "./types";

export const pnlService = {
  async orders(params: {
    page?: number;
    limit?: number;
    sort?: PnlSort;
    status?: string;
    from?: string;
    to?: string;
  } = {}): Promise<PnlListPage> {
    return httpClient.get<PnlListPage>("/pnl/orders", params);
  },

  async byOrder(orderId: string): Promise<OrderPnl> {
    const res = await httpClient.get<{ success: boolean; pnl: OrderPnl }>(
      `/pnl/order/${orderId}`
    );
    return res.pnl;
  },

  async settings(): Promise<CostSettings> {
    const res = await httpClient.get<{ success: boolean; settings: CostSettings }>(
      "/pnl/settings"
    );
    return res.settings;
  },

  saveSettings: (body: Partial<CostSettings>) =>
    httpClient.put("/pnl/settings", body),

  // Only the lines named here are touched; the rest keep their rate.
  saveRates: (orderId: string, rates: Array<{ elastic: string; rate: number }>) =>
    httpClient.put(`/pnl/order/${orderId}/rates`, { rates }),

  saveOverrides: (jobId: string, body: JobCostOverrides) =>
    httpClient.put(`/pnl/job/${jobId}/cost-overrides`, body),

  // Opened in a new tab rather than fetched: the statement is a document
  // to file and hand round, and the browser's own PDF viewer gives print
  // and save for free. The httpOnly session cookie rides along.
  pdfUrl: (orderId: string) => `${config.apiBaseUrl}/pnl/order/${orderId}.pdf`,
};
