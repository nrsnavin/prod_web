import { httpClient } from "@/core/http/httpClient";
import { config } from "@/app/config";
import {
  OrderDeliveryChallans,
  OrderDetail,
  OrderEtaEstimate,
  OrderFilter,
  OrderFormValues,
  OrderListPage,
  OrderMrp,
  OrderPurchaseOrder,
  OrderYarnLots,
  RaisePoResult,
} from "./types";

export const orderService = {
  // Paged. The endpoint used to return every order ever placed; it now caps
  // each response, so the caller has to walk the pages to be complete.
  async list(
    status: OrderFilter,
    { page = 1, limit = 200 }: { page?: number; limit?: number } = {}
  ): Promise<OrderListPage> {
    return httpClient.get<OrderListPage>("/order/list", { status, page, limit });
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

  // ── Material requirement for the whole order ──────────────────────
  // The job-level MRP answers what one run needs. This answers what the
  // order needs, including quantities no job has been raised for — which
  // is the point at which yarn actually has to be bought.
  async mrp(orderId: string): Promise<OrderMrp> {
    const res = await httpClient.get<{ success: boolean; data: OrderMrp }>(
      `/order/${orderId}/mrp`
    );
    return res.data;
  },

  // ── Dye lots behind the order's goods ────────────────────────────
  // Rolled up from its jobs: what each warping programme committed to
  // and what its batches issued.
  async yarnLots(orderId: string): Promise<OrderYarnLots> {
    const res = await httpClient.get<{ success: boolean; data: OrderYarnLots }>(
      `/order/${orderId}/yarn-lots`
    );
    return res.data;
  },

  // ── Delivery notes raised for the order ─────────────────────────
  // Matched on both the reference and the order-number snapshot, so
  // older notes carrying only one of the two are not silently dropped.
  async deliveryChallans(orderId: string): Promise<OrderDeliveryChallans> {
    const res = await httpClient.get<{ success: boolean; data: OrderDeliveryChallans }>(
      `/order/${orderId}/delivery-challans`
    );
    return res.data;
  },

  raisePo(
    orderId: string,
    body: { materials?: string[]; expectedDate?: string; notes?: string } = {}
  ): Promise<RaisePoResult> {
    return httpClient.post<RaisePoResult>(`/order/${orderId}/raise-po`, body);
  },

  async purchaseOrders(orderId: string): Promise<OrderPurchaseOrder[]> {
    const res = await httpClient.get<{ success: boolean; purchaseOrders: OrderPurchaseOrder[] }>(
      `/order/${orderId}/purchase-orders`
    );
    return res.purchaseOrders;
  },

  statusReportPdfUrl: (orderId: string) =>
    `${config.apiBaseUrl}/order/${orderId}/status-report.pdf`,
};
