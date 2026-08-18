import { httpClient } from "@/core/http/httpClient";

// Mirrors GET /api/v2/health/ai (prod/app.js) — the report that answers
// "is our AI working", which before the suggestion ledger existed had no
// answer anywhere in the system.

export interface ModelInfo {
  id: string;
  /**
   * False means the model string is an ALIAS — it resolves to whatever
   * snapshot is current upstream and can change with no deploy on our
   * side. That is the one kind of change nothing else can be correlated
   * with, so the page says so plainly rather than burying it.
   */
  pinned: boolean;
}

export interface SurfaceStats {
  surface: string;
  total: number;
  decided: number;
  pending: number;
  accepted: number;
  edited: number;
  rejected: number;
  failed: number;
  /** Applied with no changes at all. Null when nothing has been decided. */
  acceptRate: number | null;
  /** Accepted OR edited — worth having even if it needed a touch. */
  usefulRate: number | null;
  avgLatencyMs: number | null;
  tokens: { input: number; output: number };
}

export interface WeakField {
  surface: string;
  field: string;
  /** Suggestions that needed this field touched — not individual cells. */
  suggestions: number;
}

export interface AiHealth {
  status: "ok" | "degraded";
  configured: boolean;
  windowDays: number;
  models: { text: ModelInfo; vision: ModelInfo };
  prompts: Record<string, string>;
  surfaces?: SurfaceStats[];
  weakestFields?: WeakField[];
  ledgerError?: string;
}

export const aiHealthService = {
  get(days: number, withFields = true): Promise<AiHealth> {
    return httpClient.get("/health/ai", { days, ...(withFields ? { fields: 1 } : {}) });
  },
};

/** How each surface is described to somebody who did not build it. */
export const SURFACE_LABELS: Record<string, { label: string; blurb: string }> = {
  "shift-sheet-ocr": {
    label: "Shift sheet OCR",
    blurb: "Reads handwritten production, timer and remarks off a scanned sheet.",
  },
  "qc-vision": {
    label: "QC vision",
    blurb: "Flags visible defects on a photo of elastic tape before the inspector fills the check.",
  },
  "planner-rationale": {
    label: "Planner rationale",
    blurb: "Explains a proposed machine schedule. Narrative only — it never writes a figure.",
  },
  "advisor-briefing": {
    label: "Morning briefing",
    blurb: "Summarises the day's alert cards. Nothing follows from it, so only cost and failures are tracked.",
  },
  "assistant-answer": {
    label: "Ask Jarvis",
    blurb: "Answers questions over read-only queries. One row per question, not per model call.",
  },
  "defect-root-cause": {
    label: "Defect root cause",
    blurb: "Writes the sentence over a completed attribution. Every figure it is given was computed first.",
  },
  "inbound-po-ocr": {
    label: "Customer PO intake",
    blurb: "Reads a customer's purchase order. The only surface reading a document nobody here designed.",
  },
  "complaint-themes": {
    label: "Complaint themes",
    blurb:
      "Groups complaint prose into recurring themes. Never settled by a human, so it shows no accept rate — " +
      "it is here for cost, latency and failures.",
  },
};
