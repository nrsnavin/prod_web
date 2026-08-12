import { httpClient } from "@/core/http/httpClient";
import {
  DcFormValues,
  DcOrderInfo,
  DcStatus,
  DcType,
  DcUpdateBody,
  DeliveryChallan,
} from "./types";

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

  // Server-rendered PDF via the visual template designer.
  pdfBlob(id: string): Promise<Blob> {
    return httpClient.getBlob(`/dc/${id}/pdf`);
  },

  async create(body: DcFormValues): Promise<DeliveryChallan> {
    const res = await httpClient.post<{ success: boolean; dc: DeliveryChallan }>(
      "/dc/create",
      body
    );
    return res.dc;
  },

  // Editing a challan MOVES STOCK: the backend reverses every line and
  // re-applies the new ones. Sending `items` at all triggers that; omit
  // the key to change only the despatch detail (vehicle, driver, LR).
  async update(body: DcUpdateBody): Promise<DeliveryChallan> {
    const res = await httpClient.put<{ success: boolean; dc: DeliveryChallan }>(
      "/dc/update",
      body
    );
    return res.dc;
  },

  updateStatus: (id: string, status: DcStatus) =>
    httpClient.patch("/dc/update-status", { id, status }),

  remove: (id: string) => httpClient.delete("/dc/delete", { id }),
};
