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

export const elasticService = {
  async list(params: { page?: number; limit?: number; search?: string; includeArchived?: string }) {
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

  async update(id: string, body: ElasticFormValues): Promise<Elastic> {
    const res = await httpClient.put<{ success: boolean; elastic: Elastic }>(
      "/elastic/update-elastic",
      { _id: id, ...body }
    );
    return res.elastic;
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

  async recalculateCost(elasticId: string): Promise<void> {
    await httpClient.post("/elastic/recalculate-elastic-cost", { elasticId });
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
