import { httpClient } from "@/core/http/httpClient";
import {
  InwardRecord,
  PoFormValues,
  PoStatus,
  PurchaseOrder,
  Supplier,
  SupplierFormValues,
} from "./types";

export const supplierService = {
  async list(params: { page?: number; limit?: number; search?: string }) {
    const res = await httpClient.get<{
      success: boolean;
      suppliers: Supplier[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>("/supplier/get-suppliers", params);
    return res;
  },

  async create(body: SupplierFormValues): Promise<Supplier> {
    const res = await httpClient.post<{ success: boolean; supplier: Supplier }>(
      "/supplier/create-supplier",
      body
    );
    return res.supplier;
  },

  async update(id: string, body: SupplierFormValues): Promise<Supplier> {
    const res = await httpClient.put<{ success: boolean; supplier: Supplier }>(
      "/supplier/edit-supplier",
      { _id: id, ...body }
    );
    return res.supplier;
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete("/supplier/delete-supplier", { id });
  },
};

export const poService = {
  async list(params: {
    page?: number;
    limit?: number;
    status?: PoStatus | "all";
    supplierId?: string;
    search?: string;
  }) {
    const query: Record<string, unknown> = {
      page: params.page,
      limit: params.limit,
    };
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.supplierId) query.supplierId = params.supplierId;
    if (params.search) query.search = params.search;
    const res = await httpClient.get<{
      success: boolean;
      pos: PurchaseOrder[];
      pagination: { page: number; total: number; totalPages: number };
    }>("/supplier/get-pos", query);
    return res;
  },

  async getById(id: string): Promise<{ po: PurchaseOrder; inwardHistory: InwardRecord[] }> {
    const res = await httpClient.get<{
      success: boolean;
      po: PurchaseOrder;
      inwardHistory: InwardRecord[];
    }>("/supplier/get-po-detail", { id });
    return { po: res.po, inwardHistory: res.inwardHistory ?? [] };
  },

  async create(body: PoFormValues): Promise<PurchaseOrder> {
    const res = await httpClient.post<{ success: boolean; po: PurchaseOrder }>(
      "/supplier/create-po",
      body
    );
    return res.po;
  },

  async clone(id: string): Promise<PurchaseOrder> {
    const res = await httpClient.post<{ success: boolean; po: PurchaseOrder }>(
      "/supplier/clone-po",
      { id }
    );
    return res.po;
  },

  async inwardStock(
    poId: string,
    items: Array<{ rawMaterial: string; quantity: number; inwardDate?: string; remarks?: string; lotNo?: string }>
  ): Promise<{ message: string; poStatus: PoStatus }> {
    const res = await httpClient.post<{
      success: boolean;
      message: string;
      poStatus: PoStatus;
    }>("/supplier/inward-stock", { poId, items });
    return res;
  },
};
