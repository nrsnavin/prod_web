import { httpClient } from "@/core/http/httpClient";

/**
 * What /job/update-elastics answers with.
 *
 * `lots` is the part worth reading. Replanning restates the order's
 * material requirement, and a requirement that falls below what the
 * order had already set aside gets the surplus trimmed — yarn ceasing
 * to be spoken for without anybody asking for it. The server says which
 * materials that happened on; the modal repeats it, because the person
 * who just replanned is the only one who can decide where the freed
 * yarn should go.
 */
export interface UpdateElasticsResult {
  success: boolean;
  message: string;
  lots?: {
    trimmed: Array<{ rawMaterial: string; name: string; from: number; to: number; required: number }>;
    released: Array<{ rawMaterial: string; name: string; quantity: number }>;
  };
}
import { config } from "@/app/config";
import {
  JobDetail,
  JobListItem,
  JobPurchaseOrder,
  JobStatus,
  JobSummaryRow,
  JobYarnLots,
  MachineAssignResult,
  MrpData,
  RaisePoResult,
  WeavingReadiness,
} from "./types";

export const jobService = {
  async list(params: {
    page: number; limit?: number; status: JobStatus | "all";
    search?: string; customer?: string;
  }) {
    const query: Record<string, unknown> = {
      page: params.page,
      limit: params.limit ?? 20,
    };
    if (params.status !== "all") query.status = params.status;
    if (params.search) query.search = params.search;
    // Server-side, because `search` matches only a job number and the
    // page cap would otherwise hide a customer's older jobs entirely.
    if (params.customer) query.customer = params.customer;
    const res = await httpClient.get<{
      success: boolean;
      jobs: JobListItem[];
      pagination: { total: number; page: number; pages: number };
    }>("/job/jobs", query);
    return res;
  },

  async getById(id: string): Promise<JobDetail> {
    const res = await httpClient.get<{ success: boolean; data: JobDetail }>(`/job/${id}`);
    return res.data;
  },

  async create(body: {
    orderId: string;
    date: string;
    elastics: Array<{ elastic: string; quantity: number }>;
    /**
     * Only needed when a line is planned more than 20% over what the
     * order asked for. Without it the server answers 409
     * EXCESS_PLANNING_REASON_REQUIRED, naming the lines — re-send the
     * same request with this filled in.
     */
    excessReason?: string;
  }): Promise<{ job: { _id: string; jobOrderNo: number } }> {
    const res = await httpClient.post<{
      success: boolean;
      data: { job: { _id: string; jobOrderNo: number } };
    }>("/job/create", body);
    return res.data;
  },

  async summary(jobId: string): Promise<JobSummaryRow[]> {
    const res = await httpClient.get<{ success: boolean; summary: JobSummaryRow[] }>(
      "/job/summary",
      { jobId }
    );
    return res.summary;
  },

  /**
   * `confirmHooks` goes ahead with a head map the machine cannot run as
   * specified — an elastic needing more hooks than the machine has. The
   * server refuses with HOOKS_EXCEED_MACHINE until it is set, so the
   * override is always a second, deliberate request.
   */
  planWeaving: (
    jobId: string,
    machineId: string,
    headElasticMap: Record<string, string>,
    confirmHooks = false
  ) =>
    httpClient.post<MachineAssignResult>("/job/plan-weaving", {
      jobId, machineId, headElasticMap,
      ...(confirmHooks ? { confirmHooks: true } : {}),
    }),

  /**
   * Change what the job is planned to make.
   *
   * Only while it is still preparatory and the floor has not started —
   * past that, yarn has been drawn against these figures and the machine
   * is working to a sheet the paperwork would no longer match. The server
   * enforces that and cascades the new numbers to the warping order, the
   * covering plan, the order's pending quantities and its MRP.
   */
  updateElastics: (
    jobId: string,
    elastics: Array<{ elastic: string; quantity: number }>,
    auditReason: string
  ) =>
    httpClient.post<UpdateElasticsResult>("/job/update-elastics", {
      jobId,
      elastics,
      auditReason,
    }),

  updateStatus: (jobId: string, nextStatus: JobStatus) =>
    httpClient.post("/job/update-status", { jobId, nextStatus }),

  cancel: (jobId: string, reason?: string) => httpClient.post("/job/cancel", { jobId, reason }),

  // Read-only: what is still open before the job may go to weaving.
  async weavingReadiness(jobId: string): Promise<WeavingReadiness> {
    const res = await httpClient.get<{ success: boolean; data: WeavingReadiness }>(
      `/job/${jobId}/weaving-readiness`
    );
    return res.data;
  },

  assignMachine: (jobId: string, machineId: string) =>
    httpClient.post<MachineAssignResult>("/job/assign-machine", { jobId, machineId }),

  async mrp(jobId: string): Promise<MrpData> {
    const res = await httpClient.get<{ success: boolean; data: MrpData }>(`/job/${jobId}/mrp`);
    return res.data;
  },

  mrpPdfUrl: (jobId: string) => `${config.apiBaseUrl}/job/${jobId}/mrp.pdf`,

  raisePo(
    jobId: string,
    body: { materials?: string[]; expectedDate?: string; notes?: string } = {}
  ): Promise<RaisePoResult> {
    return httpClient.post<RaisePoResult>(`/job/${jobId}/raise-po`, body);
  },

  async jobPurchaseOrders(jobId: string): Promise<JobPurchaseOrder[]> {
    const res = await httpClient.get<{ success: boolean; purchaseOrders: JobPurchaseOrder[] }>(
      `/job/${jobId}/purchase-orders`
    );
    return res.purchaseOrders;
  },

  async yarnLots(jobId: string): Promise<JobYarnLots> {
    const res = await httpClient.get<{ success: boolean; data: JobYarnLots }>(
      `/job/${jobId}/yarn-lots`
    );
    return res.data;
  },

  setProductionMode: (jobId: string, productionMode: "in_house" | "outsource", outsourceVendor?: string) =>
    httpClient.patch(`/job/${jobId}/production-mode`, { productionMode, outsourceVendor }),
};
