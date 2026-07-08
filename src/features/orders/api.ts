import { httpClient } from "@/core/http/httpClient";
import { OrderDetail, OrderFormValues, OrderListItem, OrderStatus } from "./types";

export const orderService = {
  async list(status: OrderStatus): Promise<OrderListItem[]> {
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

  approve: (orderId: string) => httpClient.post("/order/approve", { orderId }),
  cancel: (orderId: string) => httpClient.post("/order/cancel", { orderId }),
  startProduction: (orderId: string) => httpClient.post("/order/start-production", { orderId }),
  complete: (orderId: string) => httpClient.post("/order/complete", { orderId }),
};
