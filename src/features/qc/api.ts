import { httpClient } from "@/core/http/httpClient";
import { MODEL_TIMEOUT_MS } from "@/core/http/timeouts";
import { QcCreateBody, QcJob, QcRecentRecord, QcVisionResponse, RootCause } from "./types";

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
    return httpClient.upload<QcVisionResponse>("/qc/vision-draft", form);
  },

  create(body: QcCreateBody): Promise<{ success: boolean; jobOrderNo: number }> {
    return httpClient.post("/qc/create", body);
  },

  // Read-only. Narrative is opt-in so the page does not spend a model
  // call on every refresh of a report whose numbers are the product.
  rootCause(days = 90, narrative = true): Promise<RootCause> {
    return httpClient.get<RootCause>("/qc/root-cause", { days, ...(narrative ? { narrative: 1 } : {}) }, narrative ? { timeoutMs: MODEL_TIMEOUT_MS } : undefined);
  },

  trainingReadiness(): Promise<TrainingReadiness> {
    return httpClient.get<TrainingReadiness>("/qc/training-readiness");
  },

  /**
   * The labelled photos, as the file the server writes.
   *
   * Taken as a blob and saved as it is. Every sample carries its photo;
   * read as JSON, parsed, and written out again indented, the browser
   * held three copies of every photo at once. And it asks for all the
   * server will give — with no number it gave the newest 500 and left
   * the rest out without a word.
   */
  exportDataset(): Promise<Blob> {
    return httpClient.getBlob("/qc/export-dataset", { limit: EXPORT_LIMIT });
  },
};

/** The most samples one export carries (the server's own ceiling). */
export const EXPORT_LIMIT = 2000;

/** What the export toast says, given how many labelled photos there are. */
export function exportedMessage(labelled: number): string {
  if (labelled > EXPORT_LIMIT) {
    return `Exported the newest ${EXPORT_LIMIT.toLocaleString("en-IN")} of ${labelled.toLocaleString("en-IN")} labelled samples`;
  }
  return `Exported ${labelled.toLocaleString("en-IN")} labelled sample${labelled === 1 ? "" : "s"}`;
}

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
