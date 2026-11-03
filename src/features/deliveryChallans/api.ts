import type { BulkResult } from "@/features/elastics/api";
import { httpClient } from "@/core/http/httpClient";
import {
  DcFormValues,
  DcOrderInfo,
  DcStatus,
  DcType,
  DcUpdateBody,
  DeliveryChallan,
} from "./types";

/** What a lorry receipt says, the transporter on file, and anything that does not fit this challan. */
export interface LrScan {
  read: {
    problem: null | "not_an_lr" | "unreadable";
    lrNumber: string; lrDate: string | null; vehicleNo: string; transporterName: string; transporterGstin: string;
    consignee: string; destination: string; packages: number | null; weightKg: number | null; freight: number | null;
    paidBy: "paid" | "to_pay" | null; confidence: number;
  };
  transporter: { _id: string; name: string; gstin?: string; gstRegistration?: "regular" | "composition" | "unregistered" } | null;
  checks: string[];
  aiSuggestion: string | null;
}

export const dcService = {
  async scanLr(id: string, file: File): Promise<LrScan> {
    const fd = new FormData();
    fd.append("files", file);
    const res = await fetch(`/api/v2/dc/${id}/lr/scan`, { method: "POST", body: fd, credentials: "include" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || "Could not read the receipt");
    return body as LrScan;
  },

  saveTransport(id: string, body: { lrNumber?: string; vehicleNo?: string; transporter?: string; driverName?: string; aiSuggestion?: string }) {
    return httpClient.post<{ success: boolean }>(`/dc/${id}/transport`, body);
  },

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

  // requestId: see core/hooks/useRequestId; the server ships each id once.
  async create(body: DcFormValues & { requestId?: string }): Promise<DeliveryChallan> {
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

  // Several at once, from the list's selection. Each challan moves on its
  // own; one that cannot (already delivered, cancelled) says why.
  bulkStatus: (ids: string[], status: "dispatched" | "delivered") =>
    httpClient.post<BulkResult>("/dc/bulk/status", { ids, status }),
  /** One PDF with every challan in it, in the order given. */
  bulkPdf: (ids: string[]): Promise<Blob> => httpClient.postBlob("/dc/bulk/pdf", { ids }),
};
