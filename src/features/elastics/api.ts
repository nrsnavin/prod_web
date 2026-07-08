import { httpClient } from "@/core/http/httpClient";
import { Elastic, ElasticFormValues, MaterialsByCategory } from "./types";

export const elasticService = {
  async list(params: { page?: number; limit?: number; search?: string }) {
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

  async materialsByCategory(): Promise<MaterialsByCategory> {
    return httpClient.get<MaterialsByCategory>("/materials/materialForNewElastic");
  },
};
