import { httpClient } from "@/core/http/httpClient";
import {
  WastageAnalytics,
  WastageEligibleJob,
  WastageFormValues,
  WastageJobRow,
  WastageRecord,
  WastageRootCause,
} from "./types";

export const wastageService = {
  async jobsWithWastage(search?: string): Promise<WastageJobRow[]> {
    const res = await httpClient.get<{ success: boolean; jobs: WastageJobRow[] }>(
      "/wastage/jobs-wastage-list",
      search ? { search } : undefined
    );
    return res.jobs;
  },

  async byJob(jobId: string): Promise<WastageRecord[]> {
    const res = await httpClient.get<{ success: boolean; wastages: WastageRecord[] }>(
      "/wastage/get-by-job",
      { jobId }
    );
    return res.wastages;
  },

  async eligibleJobs(): Promise<WastageEligibleJob[]> {
    const res = await httpClient.get<{ success: boolean; jobs: WastageEligibleJob[] }>(
      "/wastage/jobs-for-wastage"
    );
    return res.jobs;
  },

  async analytics(days = 30): Promise<WastageAnalytics> {
    const res = await httpClient.get<{ success: boolean; analytics: WastageAnalytics }>(
      "/wastage/analytics",
      { days }
    );
    return res.analytics;
  },

  async rootCause(days = 30): Promise<WastageRootCause> {
    return httpClient.get<WastageRootCause>("/wastage/root-cause", { days });
  },

  add: (body: WastageFormValues) => httpClient.post("/wastage/add-wastage", body),
};
