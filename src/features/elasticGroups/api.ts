import { httpClient } from "@/core/http/httpClient";
import { ElasticGroup, ElasticGroupFormValues } from "./types";

export const elasticGroupService = {
  async list(customerId?: string): Promise<ElasticGroup[]> {
    const res = await httpClient.get<{ success: boolean; groups: ElasticGroup[] }>(
      "/elastic-group",
      customerId ? { customerId } : undefined
    );
    return res.groups;
  },
  async getById(id: string): Promise<ElasticGroup> {
    const res = await httpClient.get<{ success: boolean; group: ElasticGroup }>(`/elastic-group/${id}`);
    return res.group;
  },
  async create(body: ElasticGroupFormValues): Promise<ElasticGroup> {
    const res = await httpClient.post<{ success: boolean; group: ElasticGroup }>("/elastic-group", {
      ...body,
      customer: body.customer || null,
    });
    return res.group;
  },
  async update(id: string, body: ElasticGroupFormValues): Promise<ElasticGroup> {
    const res = await httpClient.put<{ success: boolean; group: ElasticGroup }>(`/elastic-group/${id}`, {
      ...body,
      customer: body.customer || null,
    });
    return res.group;
  },
  remove: (id: string) => httpClient.delete(`/elastic-group/${id}`),
};
