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

  updatePlan: (planId: string, body: { remarks?: string; auditReason: string }) =>
    httpClient.put(`/warping/warpingPlan/${planId}`, body),
  deletePlan: (planId: string, auditReason: string) =>
    httpClient.delete(`/warping/warpingPlan/${planId}`, { auditReason }),

  optimizeLayout: (warpingId: string, capacity = 600): Promise<OptimizedLayout> =>
    httpClient.get<OptimizedLayout>(`/warping/optimize-layout/${warpingId}`, { capacity }),
};

export interface OptimizedBeam {
  beamNo: number;
  totalEnds: number;
  fillPct: number;
  sections: Array<{ warpYarnId: string; warpYarnName: string; ends: number }>;
}

export interface OptimizedLayout {
  success: boolean;
  warpingId: string;
  jobOrderNo?: number;
  capacity: number;
  message?: string;
  metrics?: {
    beamsUsed: number;
    baselineBeams: number;
    beamsSaved: number;
    totalEnds: number;
    totalYarns: number;
    changeovers: number;
    fillRate: number;
  };
  beams?: OptimizedBeam[];
  assumptions?: string[];
}

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
