import { httpClient } from "@/core/http/httpClient";
import {
  Covering,
  PlanContext,
  ProgrammeStatus,
  Warping,
  WarpingBatch,
  WarpingPlan,
} from "./types";

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

  // POST, not PUT: the routes are declared POST, and Express answers a
  // known path with an unknown verb by 404ing — so pressing Start
  // reported "not found" for a warping that plainly existed.
  start: (id: string) => httpClient.post("/warping/start", { id }),
  complete: (id: string) => httpClient.post("/warping/complete", { id }),
  cancel: (id: string) => httpClient.patch(`/warping/cancel/${id}`),

  async getPlan(warpingId: string): Promise<{ exists: boolean; plan?: WarpingPlan }> {
    return httpClient.get<{ exists: boolean; plan?: WarpingPlan }>("/warping/warpingPlan", {
      id: warpingId,
    });
  },

  async planContext(jobId: string): Promise<PlanContext> {
    return httpClient.get<PlanContext>(`/warping/plan-context/${jobId}`);
  },

  createPlan: (body: {
    warpingId: string;
    // beamNo is sent so combined beams can refer to each other by number;
    // the web previously sent neither, leaving stored beams unnumbered and
    // every view falling back to the array position.
    beams: Array<{
      beamNo?: number;
      pairedBeamNo?: number | null;
      sections: Array<{ warpYarn: string; ends: number; maxMeters?: number }>;
    }>;
    remarks?: string;
  }) => httpClient.post("/warping/warpingPlan/create", body),

  updatePlan: (planId: string, body: { remarks?: string; auditReason: string }) =>
    httpClient.put(`/warping/warpingPlan/${planId}`, body),
  deletePlan: (planId: string, auditReason: string) =>
    httpClient.delete(`/warping/warpingPlan/${planId}`, { auditReason }),

  optimizeLayout: (warpingId: string, capacity = 600): Promise<OptimizedLayout> =>
    httpClient.get<OptimizedLayout>(`/warping/optimize-layout/${warpingId}`, { capacity }),

  // ── Batches ───────────────────────────────────────────────────────
  async batches(warpingId: string): Promise<WarpingBatch[]> {
    const res = await httpClient.get<{ success: boolean; batches: WarpingBatch[] }>(
      "/warping/batch/list",
      { warpingId }
    );
    return res.batches;
  },

  async createBatch(body: {
    warpingId: string;
    beamNos: number[];
    allocations: Array<{ rawMaterial: string; yarnLot: string; quantity: number }>;
    // Which elastic(s) this batch warps. Omit when the job has one — the
    // server fills that in, since there is nothing to choose between.
    elastics?: string[];
    remarks?: string;
  }): Promise<WarpingBatch> {
    const res = await httpClient.post<{ success: boolean; batch: WarpingBatch }>(
      "/warping/batch/create",
      body
    );
    return res.batch;
  },

  issueBatch: (id: string) => httpClient.post(`/warping/batch/${id}/issue`, {}),
  completeBatch: (id: string) => httpClient.post(`/warping/batch/${id}/complete`, {}),
  cancelBatch: (id: string) => httpClient.patch(`/warping/batch/${id}/cancel`, {}),
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

  addBeamEntry: (id: string, beamNo: number, weight: number, note?: string) =>
    httpClient.post("/covering/beam-entry", { id, beamNo, weight, note }),
  deleteBeamEntry: (coveringId: string, entryId: string) =>
    httpClient.delete("/covering/beam-entry", { coveringId, entryId }),
};
