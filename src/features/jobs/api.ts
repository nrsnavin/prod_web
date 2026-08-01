import { httpClient } from "@/core/http/httpClient";
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
  async list(params: { page: number; limit?: number; status: JobStatus | "all"; search?: string }) {
    const query: Record<string, unknown> = {
      page: params.page,
      limit: params.limit ?? 20,
    };
    if (params.status !== "all") query.status = params.status;
    if (params.search) query.search = params.search;
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

  planWeaving: (jobId: string, machineId: string, headElasticMap: Record<string, string>) =>
    httpClient.post<MachineAssignResult>("/job/plan-weaving", { jobId, machineId, headElasticMap }),

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
