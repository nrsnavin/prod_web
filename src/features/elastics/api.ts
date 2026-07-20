import { httpClient } from "@/core/http/httpClient";
import { Elastic, ElasticFormValues, MaterialsByCategory } from "./types";

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

  async create(body: ElasticFormValues): Promise<Elastic> {
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

  /** Permanent delete. The backend refuses while stock, reservations or
   *  stock movements exist (no force from the UI — archive instead). */
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/elastic/delete-elastic?id=${encodeURIComponent(id)}`);
  },

  async materialsByCategory(): Promise<MaterialsByCategory> {
    return httpClient.get<MaterialsByCategory>("/materials/materialForNewElastic");
  },
};
