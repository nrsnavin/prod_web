import { httpClient } from "@/core/http/httpClient";
import {
  BulkPriceResult,
  LotTrace,
  MaterialFormValues,
  RawMaterial,
  ReplenishmentForecast,
  SupplierOption,
  YarnLot,
  YarnLotStatus,
} from "./types";

export const materialService = {
  replenishmentForecast(horizonDays = 14, lookbackDays = 30): Promise<ReplenishmentForecast> {
    return httpClient.get<ReplenishmentForecast>("/materials/replenishment-forecast", {
      horizonDays,
      lookbackDays,
    });
  },

  async list(params: { search?: string; category?: string; lowStock?: boolean }): Promise<RawMaterial[]> {
    const query: Record<string, unknown> = {};
    if (params.search) query.search = params.search;
    if (params.category && params.category !== "all") query.category = params.category;
    if (params.lowStock) query.lowStock = "true";
    const res = await httpClient.get<{ success: boolean; materials: RawMaterial[] }>(
      "/materials/get-raw-materials",
      query
    );
    return res.materials;
  },

  async getById(id: string): Promise<RawMaterial> {
    const res = await httpClient.get<{ success: boolean; material: RawMaterial }>(
      "/materials/get-raw-material-detail",
      { id }
    );
    return res.material;
  },

  async create(body: MaterialFormValues): Promise<RawMaterial> {
    const res = await httpClient.post<{ success: boolean; material: RawMaterial }>(
      "/materials/create-raw-material",
      body
    );
    return res.material;
  },

  async update(id: string, body: MaterialFormValues): Promise<RawMaterial> {
    const res = await httpClient.put<{ success: boolean; material: RawMaterial }>(
      "/materials/edit-raw-material",
      { _id: id, ...body }
    );
    return res.material;
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete("/materials/delete-raw-material", { id });
  },

  async adjustStock(
    id: string,
    adjustment: number,
    reason: string,
    // The lot side of the same movement. Adding names a lot number
    // (opening the bucket if new); removing picks an existing lot by id.
    lot: { lotNo?: string; shade?: string; yarnLot?: string } = {}
  ): Promise<void> {
    await httpClient.post("/materials/bulk-adjust-stock", {
      adjustments: [
        {
          _id: id,
          adjustment,
          reason,
          lotNo: lot.lotNo || undefined,
          shade: lot.shade || undefined,
          yarnLot: lot.yarnLot || undefined,
        },
      ],
    });
  },

  async bulkUpdatePrices(
    updates: Array<{ _id: string; price: number }>,
    reason: string
  ): Promise<BulkPriceResult> {
    return httpClient.post<BulkPriceResult>("/materials/bulk-update-prices", {
      updates,
      reason,
    });
  },

  // ── Dye lots ──────────────────────────────────────────────────────
  async lots(params: {
    material?: string;
    status?: YarnLotStatus | "all";
    issuable?: boolean;
    search?: string;
  }): Promise<YarnLot[]> {
    const query: Record<string, unknown> = {};
    if (params.material) query.material = params.material;
    if (params.status) query.status = params.status;
    if (params.issuable) query.issuable = "true";
    if (params.search) query.search = params.search;
    const res = await httpClient.get<{ success: boolean; lots: YarnLot[] }>(
      "/yarn-lots/list",
      query
    );
    return res.lots;
  },

  async createLot(body: {
    rawMaterial: string;
    lotNo: string;
    // Bounded server-side by the material's unassigned stock: a lot is an
    // assignment of stock that exists, not a number typed from nothing.
    quantity: number;
    shade?: string;
    dyer?: string;
    remarks?: string;
  }): Promise<YarnLot> {
    const res = await httpClient.post<{ success: boolean; lot: YarnLot }>(
      "/yarn-lots/create",
      body
    );
    return res.lot;
  },

  async setLotStatus(
    id: string,
    status: "open" | "quarantined" | "closed",
    remarks?: string
  ): Promise<YarnLot> {
    const res = await httpClient.patch<{ success: boolean; lot: YarnLot }>(
      `/yarn-lots/${id}/status`,
      { status, remarks }
    );
    return res.lot;
  },

  traceLot(id: string): Promise<LotTrace> {
    return httpClient.get<LotTrace>(`/yarn-lots/${id}/trace`);
  },

  async supplierOptions(search?: string): Promise<SupplierOption[]> {
    const res = await httpClient.get<{ success: boolean; suppliers: SupplierOption[] }>(
      "/materials/suppliers",
      search ? { search } : undefined
    );
    return res.suppliers;
  },
};
