import { httpClient } from "@/core/http/httpClient";
import {
  ElasticRemoveResult,
  Elastic,
  ElasticCreateBody,
  ElasticFormValues,
  ElasticJobRow,
  ElasticOrderRow,
  MaterialsByCategory,
} from "./types";

export interface BulkItemResult {
  id: string;
  name?: string;
  ok: boolean;
  reason?: string;
  unchanged?: boolean;
  before?: { conversionCost: number; totalCost: number | null };
  after?: { conversionCost: number; totalCost: number };
}
export interface BulkUploadResult {
  added: number;
  updated: number;
  /** "Elastics row 4 "X": a new elastic needs pick" — one per row not saved. */
  skipped: string[];
  /** Saved, but something to know (e.g. its cost could not be worked out). */
  warnings: string[];
  message: string;
}

export interface RecostResult {
  costing: { materialCost: number; conversionCost: number; totalCost: number };
  before: { materialCost: number | null; conversionCost: number | null; totalCost: number | null } | null;
}

/** "Cost recalculated: ₹2.28 → ₹2.34 a metre", or that nothing moved. */
export function recostMessage(r: RecostResult): string {
  const rupees = (n: number) => `₹${n.toFixed(2)}`;
  const after = r.costing.totalCost;
  const before = r.before?.totalCost;
  if (before == null) return `Cost recalculated: ${rupees(after)} a metre`;
  if (Math.abs(after - before) < 0.005) return `Cost unchanged at ${rupees(after)} a metre`;
  return `Cost recalculated: ${rupees(before)} → ${rupees(after)} a metre`;
}

export interface BulkResult {
  done: number;
  refused: number;
  results: BulkItemResult[];
}

export const elasticService = {
  async list(params: {
    page?: number; limit?: number; search?: string; includeArchived?: string; lowStock?: string;
    /** Comma-separated: just these elastics. */
    ids?: string;
  }) {
    const res = await httpClient.get<{
      success: boolean;
      elastics: Elastic[];
      total: number;
      page: number;
    }>("/elastic/get-elastics", params);
    return res;
  },

  async getById(id: string): Promise<Elastic> {
    const res = await httpClient.get<{ success: boolean; elastic: Elastic }>(
      "/elastic/get-elastic-detail",
      { id }
    );
    return res.elastic;
  },

  async create(body: ElasticCreateBody): Promise<Elastic> {
    const res = await httpClient.post<{ success: boolean; elastic: Elastic }>(
      "/elastic/create-elastic",
      body
    );
    return res.elastic;
  },

  async update(
    id: string, body: ElasticFormValues, expectedVersion?: number
  ): Promise<Elastic & { costingWarning?: string }> {
    const res = await httpClient.put<{ success: boolean; elastic: Elastic; costingWarning?: string }>(
      "/elastic/update-elastic",
      { _id: id, ...body, ...(expectedVersion === undefined ? {} : { expectedVersion }) }
    );
    // Saved, but the cost sheet could not be recalculated (a material that
    // cannot be priced, say) — the cost sheet is left as it was.
    return res.costingWarning ? { ...res.elastic, costingWarning: res.costingWarning } : res.elastic;
  },

  // Saving the template on its own, so the detail page can edit it
  // without pushing the whole elastic (and re-running its costing)
  // through /update-elastic. Passing an absent template clears it.
  async saveWarpingTemplate(
    elasticId: string,
    template?: { beams: Array<{ beamNo: number; sections: Array<{ warpYarn: string; ends: number; maxMeters: number }> }> }
  ): Promise<Elastic> {
    const res = await httpClient.put<{ success: boolean; elastic: Elastic }>(
      "/elastic/warping-plan-template",
      { elasticId, template: template ?? null }
    );
    return res.elastic;
  },

  // Several at once, from the list's selection. Each comes back with its
  // own result: one refused (stock reserved) does not stop the others.
  bulkArchive(ids: string[], archived: boolean) {
    return httpClient.post<BulkResult>("/elastic/bulk/archive", { ids, archived });
  },
  bulkCosting(ids: string[], change: { conversionCost?: number; changePercent?: number }) {
    return httpClient.post<BulkResult>("/elastic/bulk/costing", { ids, ...change });
  },
  bulkMinStock(ids: string[], minStock: number) {
    return httpClient.post<BulkResult>("/elastic/bulk/min-stock", { ids, minStock });
  },
  bulkCopyTemplate(sourceId: string, ids: string[], replace: boolean) {
    return httpClient.post<BulkResult>("/elastic/bulk/copy-template", { sourceId, ids, replace });
  },
  bulkTesting(ids: string[], params: { width?: number; elongation?: number; recovery?: number; strech?: string }) {
    return httpClient.post<BulkResult>("/elastic/bulk/testing", { ids, ...params });
  },
  specSheetPdf(ids: string[]): Promise<Blob> {
    return httpClient.postBlob("/elastic/bulk/spec-sheet", { ids });
  },
  priceListPdf(ids: string[], opts: { marginPercent: number; customerName?: string; gstPercent?: number | null; validDays?: number }): Promise<Blob> {
    return httpClient.postBlob("/elastic/bulk/price-list", { ids, ...opts });
  },

  /**
   * Re-cost at today's material prices, the grammages as last edited and
   * the conversion cost as last set. Comes back with what it was before,
   * so the screen can say what changed.
   */
  async recalculateCost(elasticId: string): Promise<RecostResult> {
    return httpClient.post<RecostResult>("/elastic/recalculate-elastic-cost", { elasticId });
  },

  /** Mark inactive (archived: true) or reactivate (archived: false).
   *  Reversible; the backend refuses when stock is reserved on orders. */
  async setArchived(id: string, archived: boolean): Promise<{ message?: string }> {
    return httpClient.patch<{ success: boolean; message?: string }>(
      `/elastic/${id}/archive`,
      { archived }
    );
  },

  /**
   * Ask to remove an elastic.
   *
   * The server decides which it can be. An elastic named by an order, a
   * job, a delivery challan or a packing entry is ARCHIVED — deleting
   * it would leave all of those pointing at nothing, and no flag on the
   * request makes that safe. One nothing references is deleted, subject
   * to its own guards (stock, reservations, movements).
   *
   * The reply says which happened, so the screen never reports a
   * deletion that did not occur.
   */
  async remove(id: string): Promise<ElasticRemoveResult> {
    return httpClient.delete<ElasticRemoveResult>(
      `/elastic/delete-elastic?id=${encodeURIComponent(id)}`
    );
  },

  /** The Excel workbook to fill for a bulk upload; with a worked example row if asked. */
  bulkTemplate(withExample = false): Promise<Blob> {
    return httpClient.getBlob("/elastic/bulk/template", withExample ? { example: "1" } : undefined);
  },
  /** Upload the filled workbook. Rows that could not be saved come back with the reason. */
  bulkUpload(file: File): Promise<BulkUploadResult> {
    const form = new FormData();
    form.append("file", file);
    return httpClient.post<BulkUploadResult>("/elastic/bulk/upload", form);
  },

  async materialsByCategory(): Promise<MaterialsByCategory> {
    return httpClient.get<MaterialsByCategory>("/materials/materialForNewElastic");
  },

  // ── Where this elastic has been ───────────────────────────────────
  // Both paginate: a product in the catalogue for years has hundreds of
  // orders and hundreds of jobs, and neither list has a natural end.
  async orders(
    id: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<{
    orders: ElasticOrderRow[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }> {
    return httpClient.get(`/elastic/${id}/orders`, { limit: 10, ...params });
  },

  async jobs(
    id: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<{
    jobs: ElasticJobRow[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }> {
    return httpClient.get(`/elastic/${id}/jobs`, { limit: 10, ...params });
  },
};
