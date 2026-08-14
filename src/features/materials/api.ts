import { httpClient } from "@/core/http/httpClient";
import {
  BulkPriceResult,
  RemoveResult,
  LotTrace,
  MaterialFormValues,
  RawMaterial,
  ReplenishmentForecast,
  SupplierOption,
  YarnLot,
  YarnLotStatus,
} from "./types";

/**
 * Turn the form's group field into what the server takes.
 *
 * The picker holds a MaterialGroup id, except for a material whose
 * category no group carries — those show as `name:<category>` so they
 * can be saved without being quietly moved somewhere else. The server
 * accepts either a `group` id or a `category` name and settles the two
 * against each other; this just picks which one to send.
 */
function unpackGroup(body: MaterialFormValues) {
  const { group, ...rest } = body;
  if (group?.startsWith("name:")) {
    return { ...rest, category: group.slice(5), group: undefined };
  }
  return { ...rest, group };
}

export const materialService = {
  /**
   * `coverDays` — how long an order should last once it arrives.
   *
   * NOT `horizonDays`. The reorder point comes from the supplier's lead
   * time now, so a look-ahead window decides nothing; sending one would
   * be a control on screen that changes no number, which is worse than
   * no control at all.
   */
  replenishmentForecast(
    coverDays = 30,
    lookbackDays = 60,
    serviceLevel = 95
  ): Promise<ReplenishmentForecast> {
    return httpClient.get<ReplenishmentForecast>("/materials/replenishment-forecast", {
      coverDays,
      lookbackDays,
      serviceLevel,
    });
  },

  async list(params: {
    search?: string;
    group?: string;
    category?: string;
    lowStock?: boolean;
    /** Archived materials are out of the pickers unless asked for. */
    includeArchived?: boolean;
  }): Promise<RawMaterial[]> {
    const query: Record<string, unknown> = {};
    if (params.search) query.search = params.search;
    // A chip carries a group id now; older callers still pass a name.
    // Both are accepted by the server, and the name match is
    // case-insensitive there so "Rubber" finds rows written "rubber".
    if (params.group && params.group !== "all") query.group = params.group;
    else if (params.category && params.category !== "all") query.category = params.category;
    if (params.lowStock) query.lowStock = "true";
    if (params.includeArchived) query.includeArchived = "true";
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
      unpackGroup(body)
    );
    return res.material;
  },

  async update(id: string, body: MaterialFormValues): Promise<RawMaterial> {
    const res = await httpClient.put<{ success: boolean; material: RawMaterial }>(
      "/materials/edit-raw-material",
      { _id: id, ...unpackGroup(body) }
    );
    return res.material;
  },

  /**
   * Ask to remove a material.
   *
   * The server decides which it can be: a material nothing has used is
   * deleted, and one named by an order, a PO, a goods receipt or an
   * elastic's recipe is ARCHIVED instead — deleting it would leave all
   * of those pointing at nothing. The reply says which happened and
   * where the material is used, so the screen can tell the truth
   * rather than reporting a deletion that did not occur.
   */
  async remove(id: string): Promise<RemoveResult> {
    return httpClient.delete<RemoveResult>("/materials/delete-raw-material", { id });
  },

  /** Archive (or restore) deliberately, rather than via a delete. */
  async setArchived(id: string, archived: boolean): Promise<{ message?: string }> {
    return httpClient.patch<{ message?: string }>(`/materials/${id}/archive`, { archived });
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

  /** One lot with its own ledger — GET /yarn-lots/:id. */
  async lot(id: string): Promise<YarnLot> {
    const res = await httpClient.get<{ success: boolean; lot: YarnLot }>(
      `/yarn-lots/${id}`
    );
    return res.lot;
  },

  /**
   * Correct one lot's balance. The lot and the material's aggregate move
   * together server-side — a lot corrected on its own would put the two
   * permanently out of step.
   */
  adjustLot(id: string, body: { delta: number; reason: string }) {
    return httpClient.post<{ success: boolean; balance: number; status: string }>(
      `/yarn-lots/${id}/adjust`,
      body
    );
  },

  async supplierOptions(search?: string): Promise<SupplierOption[]> {
    const res = await httpClient.get<{ success: boolean; suppliers: SupplierOption[] }>(
      "/materials/suppliers",
      search ? { search } : undefined
    );
    return res.suppliers;
  },
};
