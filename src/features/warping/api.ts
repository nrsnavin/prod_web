import { httpClient } from "@/core/http/httpClient";
import { Covering, ProgrammeStatus, Warping, WarpingPlan, WarpYarnOption } from "./types";

export const warpingService = {
  async list(params: { status: ProgrammeStatus | "all"; search: string; page: number }) {
    const res = await httpClient.get<{
      success: boolean;
      data: Warping[];
      pagination: { total: number; page: number; hasMore: boolean };
    }>("/warping/list", { ...params, limit: 20 });
    return res;
  },

  async getById(id: string): Promise<Warping> {
    const res = await httpClient.get<{ success: boolean; warping: Warping }>(
      `/warping/detail/${id}`
    );
    return res.warping;
  },

  start: (id: string) => httpClient.put(`/warping/start?id=${encodeURIComponent(id)}`),
  complete: (id: string) => httpClient.put(`/warping/complete?id=${encodeURIComponent(id)}`),
  cancel: (id: string) => httpClient.patch(`/warping/cancel/${id}`),

  async getPlan(warpingId: string): Promise<{ exists: boolean; plan?: WarpingPlan }> {
    return httpClient.get<{ exists: boolean; plan?: WarpingPlan }>("/warping/warpingPlan", {
      id: warpingId,
    });
  },

  async planContext(jobId: string): Promise<WarpYarnOption[]> {
    const res = await httpClient.get<{ success: boolean; warpYarns: WarpYarnOption[] }>(
      `/warping/plan-context/${jobId}`
    );
    return res.warpYarns;
  },

  createPlan: (body: {
    warpingId: string;
    beams: Array<{ sections: Array<{ warpYarn: string; ends: number; length?: number }> }>;
    remarks?: string;
  }) => httpClient.post("/warping/warpingPlan/create", body),
};

export const coveringService = {
  async list(params: { status: ProgrammeStatus | "all"; search: string; page: number }) {
    const res = await httpClient.get<{
      success: boolean;
      data: Covering[];
      pagination: { total: number; page: number; hasMore: boolean };
    }>("/covering/list", { ...params, limit: 20 });
    return res;
  },

  async getById(id: string): Promise<Covering> {
    const res = await httpClient.get<{ success: boolean; covering: Covering }>(
      "/covering/detail",
      { id }
    );
    return res.covering;
  },

  start: (id: string) => httpClient.post("/covering/start", { id }),
  complete: (id: string, remarks?: string) => httpClient.post("/covering/complete", { id, remarks }),
  cancel: (id: string, remarks?: string) => httpClient.post("/covering/cancel", { id, remarks }),
};
