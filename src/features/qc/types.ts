// Mirrors prod/api/qc.js

export interface QcElasticRef {
  _id: string;
  name: string;
  testingParameters?: Record<string, unknown>;
}

export interface QcJob {
  _id: string;
  jobOrderNo: number;
  status: string;
  customer?: { name?: string } | null;
  elastics: Array<{ elastic: QcElasticRef | string | null; quantity?: number }>;
}

export interface QcResultRow {
  parameter: string;
  expected: string;
  measured: string;
  pass: boolean;
}

export interface QcVisionDraft {
  overallResult: "pass" | "fail";
  confidence: number;
  defectCode: string;
  rejectedMetersHint: number;
  results: QcResultRow[];
  notes: string;
}

export interface QcVisionResponse {
  success: boolean;
  available: boolean;
  ok?: boolean;
  message?: string;
  draft?: QcVisionDraft;
  image?: string;
  spec?: { name: string; parameters: Array<{ parameter: string; expected: string }> };
  /**
   * Id of the AI-ledger row for this draft. Sent back on save so the
   * server can compare what vision proposed with what the inspector
   * settled on. Null when the ledger write failed — the check still
   * saves, we just learn nothing from this one.
   */
  aiSuggestionId?: string | null;
}

export interface QcCreateBody {
  jobId: string;
  elasticId: string;
  checkedBy?: string;
  results: QcResultRow[];
  defectCode?: string;
  rejectedMeters?: number;
  notes?: string;
  image?: string;
  aiAssisted?: boolean;
  aiSuggestionId?: string | null;
}

export interface QcRecentRecord {
  _id: string;
  overallResult: "pass" | "fail";
  defectCode: string;
  rejectedMeters: number;
  notes: string;
  aiAssisted: boolean;
  createdAt: string;
  elastic?: { name?: string } | null;
  checkedBy?: { name?: string } | null;
  job?: { jobOrderNo?: number; customer?: { name?: string } | null } | null;
}

// ══════════════════════════════════════════════════════════════════
//  DEFECT ROOT CAUSE — mirrors services/defectRootCause.js
//
//  A group-by and a chi-square over the lot trail. Every figure is
//  reproducible by hand from four collections; Claude writes only the
//  narrative and computes nothing.
// ══════════════════════════════════════════════════════════════════

export interface RootCauseRow {
  factor: "lot" | "machine" | "operator" | "shift";
  noun: string;
  key: string;
  label: string;
  checks: number;
  fails: number;
  failRatePct: number;
  restFailRatePct: number;
  /** Ratio to everyone else. Null when nothing else ever failed. */
  lift: number | null;
  chi2: number;
  p: number;
}

export interface RootCauseFinding extends RootCauseRow {
  significant: boolean;
  headline: string;
}

export interface RootCauseConfounder {
  a: { factor: string; label: string };
  b: { factor: string; label: string };
  sharedChecks: number;
  overlapPct: number;
  note: string;
}

export interface RootCause {
  success: boolean;
  windowDays: number;
  since: string;
  totals: {
    checks: number;
    fails: number;
    failRatePct: number | null;
    rejectedMeters: number;
  };
  factors: Partial<Record<"lot" | "machine" | "operator" | "shift", RootCauseRow[]>>;
  /** Only what survived the multiple-comparison correction. */
  findings: RootCauseFinding[];
  /** Pairs the data cannot separate. Both are shown; neither is blamed. */
  confounders: RootCauseConfounder[];
  method?: { minSamples: number; test: string; correction: string };
  note?: string | null;
  narrative?: string | null;
  aiGenerated?: boolean;
}
