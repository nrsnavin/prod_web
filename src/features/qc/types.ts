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
