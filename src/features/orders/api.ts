import { httpClient } from "@/core/http/httpClient";
import { OrderDetail, OrderEtaEstimate, OrderFilter, OrderFormValues, OrderListItem } from "./types";

export const orderService = {
  async list(status: OrderFilter): Promise<OrderListItem[]> {
    const res = await httpClient.get<{ success: boolean; orders: OrderListItem[] }>(
      "/order/list",
      { status }
    );
    return res.orders;
  },

  async getById(id: string): Promise<OrderDetail> {
    const res = await httpClient.get<{ success: boolean; data: OrderDetail }>(
      "/order/get-orderDetail",
      { id }
    );
    return res.data;
  },

  async create(body: OrderFormValues): Promise<string> {
    const res = await httpClient.post<{ success: boolean; orderId: string }>(
      "/order/create-order",
      body
    );
    return res.orderId;
  },

  update: (orderId: string, body: Partial<OrderFormValues> & { auditReason: string; expectedVersion?: number }) =>
    httpClient.post("/order/update-order", { orderId, ...body }),
  remove: (orderId: string, auditReason: string) =>
    httpClient.post("/order/delete-order", { orderId, auditReason }),

  // `force`/`forceReason` drive the stock-guard override: a plain approve
  // (force omitted) 400s with code INSUFFICIENT_STOCK when a raw material
  // is short; re-calling with force + a reason (>= 8 chars) deducts what
  // is available and records the override in the audit trail.
  approve: (orderId: string, force?: boolean, forceReason?: string) =>
    httpClient.post("/order/approve", { orderId, force, forceReason }),
  cancel: (orderId: string) => httpClient.post("/order/cancel", { orderId }),
  startProduction: (orderId: string) => httpClient.post("/order/start-production", { orderId }),
  complete: (orderId: string) => httpClient.post("/order/complete", { orderId }),

  // Entry-time ETA estimator — safe to call on every (debounced) change.
  async estimateCompletion(body: {
    elasticOrdered: Array<{ elastic: string; quantity: number }>;
    supplyDate?: string;
    machines?: number;
  }): Promise<OrderEtaEstimate> {
    return httpClient.post<OrderEtaEstimate>("/order/estimate-completion", body);
  },
};
