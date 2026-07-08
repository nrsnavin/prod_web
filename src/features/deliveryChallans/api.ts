import { httpClient } from "@/core/http/httpClient";
import { DcFormValues, DcOrderInfo, DcStatus, DcType, DeliveryChallan } from "./types";

export const dcService = {
  async list(params: {
    page?: number;
    limit?: number;
    type?: DcType | "all";
    status?: DcStatus | "all";
    search?: string;
  }) {
    const query: Record<string, unknown> = { page: params.page, limit: params.limit ?? 20 };
    if (params.type && params.type !== "all") query.type = params.type;
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.search) query.search = params.search;
    const res = await httpClient.get<{
      success: boolean;
      dcs: DeliveryChallan[];
      total: number;
      page: number;
    }>("/dc/list", query);
    return res;
  },

  async getById(id: string): Promise<DeliveryChallan> {
    const res = await httpClient.get<{ success: boolean; dc: DeliveryChallan }>("/dc/detail", {
      id,
    });
    return res.dc;
  },

  async orderInfo(orderId: string): Promise<DcOrderInfo> {
    return httpClient.get<DcOrderInfo & { success: boolean }>("/dc/order-info", { id: orderId });
  },

  async create(body: DcFormValues): Promise<DeliveryChallan> {
    const res = await httpClient.post<{ success: boolean; dc: DeliveryChallan }>(
      "/dc/create",
      body
    );
    return res.dc;
  },

  updateStatus: (id: string, status: DcStatus) =>
    httpClient.patch("/dc/update-status", { id, status }),

  remove: (id: string) => httpClient.delete("/dc/delete", { id }),
};
