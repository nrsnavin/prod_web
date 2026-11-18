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
  /**
   * Id of the AI-ledger row for this reading. Carried back on apply so
   * the server can record what the operator actually saved against what
   * the OCR proposed — the only measurement of this feature's accuracy
   * that exists. Null when the ledger write failed; the sheet still
   * works, we simply learn nothing from this one.
   */
  aiSuggestionId: string | null;
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

  /**
   * The floor sheet: a production sheet for a shift with no plan — every
   * machine, its job or FREE, and blank Operator / Timer / Production /
   * Supervisor-signature columns. A photo of it filled in can create the plan.
   */
  async downloadFloor(dateKey: string, shift: "DAY" | "NIGHT"): Promise<void> {
    const blob = await httpClient.getBlob("/shift/floor-sheet.pdf", { date: dateKey, shift });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floor-sheet-${dateKey}-${shift}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async ingest(planId: string, file: File): Promise<IngestResult> {
    const form = new FormData();
    form.append("file", file);
    return httpClient.upload<IngestResult>(`/shift/${planId}/ingest-sheet`, form);
  },

  // Stage reviewed values into pending-verification via the existing route.
  async applyBulk(
    entries: BulkEntry[],
    aiSuggestionId?: string | null,
  ): Promise<BulkResult> {
    return httpClient.post("/shift/bulk-enter-production", { entries, aiSuggestionId });
  },
};

/**
 * What the server did with a batch of figures. `saved` is how many it
 * took; `skipped` the rows it did not, each with why (the shift was
 * already closed, the plan is finalised, the loom was loading). This
 * was typed as a number: the server has always sent the rows.
 */
export interface BulkResult {
  success: boolean;
  saved: number;
  skipped?: Array<{ id: string; reason: string }>;
}

/** "3 sent for verification. 2 not taken: Already closed (2)." — and whether anything was left out. */
export function bulkResultMessage(res: BulkResult): { message: string; partial: boolean } {
  const skipped = Array.isArray(res.skipped) ? res.skipped : [];
  const sent = `${res.saved} shift${res.saved === 1 ? "" : "s"} sent for verification`;
  if (skipped.length === 0) return { message: sent, partial: false };
  const byReason = new Map<string, number>();
  for (const s of skipped) byReason.set(s.reason || "Not taken", (byReason.get(s.reason || "Not taken") ?? 0) + 1);
  const why = [...byReason].map(([reason, n]) => (n > 1 ? `${reason} (${n})` : reason)).join("; ");
  return { message: `${sent}. ${skipped.length} not taken: ${why}.`, partial: true };
}
