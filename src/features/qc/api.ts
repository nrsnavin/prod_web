import { httpClient } from "@/core/http/httpClient";
import { QcCreateBody, QcJob, QcRecentRecord, QcVisionResponse } from "./types";

export const qcService = {
  async jobsForQc(): Promise<QcJob[]> {
    const res = await httpClient.get<{ success: boolean; jobs: QcJob[] }>("/qc/jobs-for-qc");
    return res.jobs;
  },

  async recent(limit = 30): Promise<QcRecentRecord[]> {
    const res = await httpClient.get<{ success: boolean; records: QcRecentRecord[] }>("/qc/recent", { limit });
    return res.records;
  },

  visionDraft(elasticId: string, file: File): Promise<QcVisionResponse> {
    const form = new FormData();
    form.append("image", file);
    form.append("elasticId", elasticId);
    return httpClient.post<QcVisionResponse>("/qc/vision-draft", form);
  },

  create(body: QcCreateBody): Promise<{ success: boolean; jobOrderNo: number }> {
    return httpClient.post("/qc/create", body);
  },
};
