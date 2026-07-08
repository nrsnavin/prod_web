import { httpClient } from "@/core/http/httpClient";
import { PackingFormValues, PackingGroupedRow, PackingJob, PackingRecord } from "./types";

export const packingService = {
  async grouped(): Promise<PackingGroupedRow[]> {
    const res = await httpClient.get<{ success: boolean; grouped: PackingGroupedRow[] }>(
      "/packing/grouped"
    );
    return res.grouped;
  },

  async byJob(jobId: string): Promise<PackingRecord[]> {
    const res = await httpClient.get<{ success: boolean; packings: PackingRecord[] }>(
      `/packing/by-job/${jobId}`
    );
    return res.packings;
  },

  async jobsPacking(): Promise<PackingJob[]> {
    const res = await httpClient.get<{ success: boolean; jobs: PackingJob[] }>(
      "/packing/jobs-packing"
    );
    return res.jobs;
  },

  async employeesByDept(dept: string): Promise<Array<{ _id: string; name: string }>> {
    const res = await httpClient.get<{
      success: boolean;
      employees: Array<{ _id: string; name: string }>;
    }>(`/packing/employees-by-department/${dept}`);
    return res.employees;
  },

  create: (body: PackingFormValues) => httpClient.post("/packing/create-packing", body),
  remove: (id: string) => httpClient.delete(`/packing/${id}`),
};
