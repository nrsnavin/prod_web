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

  trainingReadiness(): Promise<TrainingReadiness> {
    return httpClient.get<TrainingReadiness>("/qc/training-readiness");
  },

  exportDataset(): Promise<{ success: boolean; count: number; exportedAt: string; samples: unknown[] }> {
    return httpClient.get("/qc/export-dataset");
  },
};

export interface TrainingReadiness {
  success: boolean;
  thresholds: { MIN_SAMPLES: number; MIN_CLASSES: number; MIN_PER_CLASS: number };
  totals: { qcRecords: number; labelledImages: number; aiAssisted: number; aiAssistedShare: number };
  classes: Array<{ defectCode: string; count: number }>;
  classesReady: number;
  progressPct: number;
  ready: boolean;
  recommendation: string;
}
