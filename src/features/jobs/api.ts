import { httpClient } from "@/core/http/httpClient";
import { config } from "@/app/config";
import { JobDetail, JobListItem, JobStatus, JobSummaryRow, MrpData } from "./types";

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
    httpClient.post("/job/plan-weaving", { jobId, machineId, headElasticMap }),

  updateStatus: (jobId: string, nextStatus: JobStatus) =>
    httpClient.post("/job/update-status", { jobId, nextStatus }),

  cancel: (jobId: string, reason?: string) => httpClient.post("/job/cancel", { jobId, reason }),

  assignMachine: (jobId: string, machineId: string) =>
    httpClient.post("/job/assign-machine", { jobId, machineId }),

  async mrp(jobId: string): Promise<MrpData> {
    const res = await httpClient.get<{ success: boolean; data: MrpData }>(`/job/${jobId}/mrp`);
    return res.data;
  },

  mrpPdfUrl: (jobId: string) => `${config.apiBaseUrl}/job/${jobId}/mrp.pdf`,

  setProductionMode: (jobId: string, productionMode: "in_house" | "outsource", outsourceVendor?: string) =>
    httpClient.patch(`/job/${jobId}/production-mode`, { productionMode, outsourceVendor }),
};
