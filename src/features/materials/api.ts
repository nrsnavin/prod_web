import { httpClient } from "@/core/http/httpClient";
import {
  BulkPriceResult,
  MaterialFormValues,
  RawMaterial,
  ReplenishmentForecast,
  SupplierOption,
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

  async adjustStock(id: string, adjustment: number, reason: string): Promise<void> {
    await httpClient.post("/materials/bulk-adjust-stock", {
      adjustments: [{ _id: id, adjustment, reason }],
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

  async supplierOptions(search?: string): Promise<SupplierOption[]> {
    const res = await httpClient.get<{ success: boolean; suppliers: SupplierOption[] }>(
      "/materials/suppliers",
      search ? { search } : undefined
    );
    return res.suppliers;
  },
};
