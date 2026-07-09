import { httpClient } from "@/core/http/httpClient";

// ── Ingest (OCR) response — mirrors POST /shift/:id/ingest-sheet ──
export interface IngestMatchedRow {
  shiftDetailId: string;
  machineID: string | null;
  operator: string | null;
  jobNo: string | null;
  status: string;
  alreadyClosed: boolean;
  production: number | null;
  timer: string | null;
  remarks: string;
  confidence: number;
}

export interface IngestUnmatchedRow {
  code: string;
  production: number | null;
  timer: string | null;
  remarks: string;
}

export interface IngestMissingRow {
  code: string;
  shiftDetailId: string;
  machineID: string | null;
  operator: string | null;
  jobNo: string | null;
}

export interface IngestResult {
  success: boolean;
  shiftPlanId: string;
  model: string;
  pages: number;
  batches: number;
  summary: { planRows: number; matched: number; unmatched: number; missing: number; lowConfidence: number };
  matched: IngestMatchedRow[];
  unmatched: IngestUnmatchedRow[];
  missing: IngestMissingRow[];
}

export interface BulkEntry {
  id: string;
  production: number;
  timer?: string;
  feedback?: string;
}

export const sheetService = {
  // Fetch the printable sheet as a blob and trigger a browser download.
  async download(planId: string, filename: string): Promise<void> {
    const blob = await httpClient.getBlob(`/shift/${planId}/production-sheet.pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async ingest(planId: string, file: File): Promise<IngestResult> {
    const form = new FormData();
    form.append("file", file);
    return httpClient.post<IngestResult>(`/shift/${planId}/ingest-sheet`, form);
  },

  // Stage reviewed values into pending-verification via the existing route.
  async applyBulk(entries: BulkEntry[]): Promise<{ success: boolean; saved: number; skipped: number }> {
    return httpClient.post("/shift/bulk-enter-production", { entries });
  },
};
