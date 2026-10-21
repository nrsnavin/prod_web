export type SlipStatus = "received" | "reading" | "ready" | "failed" | "needs_plan" | "applied" | "discarded";
export type SlipRowState = "ready" | "check" | "skip";
export type Shift = "DAY" | "NIGHT";

export interface SlipCounts {
  rows: number;
  ready: number;
  check: number;
  skip: number;
  applied: number;
  unmatched: number;
}

export interface SlipRow {
  index: number;
  shiftDetail: string | null;
  machineID: string | null;
  machineRead: string | null;
  code: string | null;
  operator: string | null;
  jobNo: string | null;
  production: number | null;
  timer: string | null;
  remarks: string;
  confidence: number | null;
  state: SlipRowState;
  notes: string[];
  expected: { low: number; high: number } | null;
  applied: boolean;
  appliedProduction: number | null;
}

export interface SlipUnmatched {
  code?: string | null;
  machineRead?: string | null;
  production?: number | null;
  timer?: string | null;
  remarks?: string | null;
}

export interface Slip {
  id: string;
  version: number;
  confirmCode: string;
  source: "whatsapp" | "web";
  sentByName: string;
  from: string | null;
  caption: string;
  status: SlipStatus;
  problem: string | null;
  format: "sheet" | "floor" | "slip" | null;
  dateKey: string | null;
  shift: Shift | null;
  dateFrom: string | null;
  createdAt: string;
  readAt: string | null;
  appliedAt: string | null;
  appliedByName: string;
  counts: SlipCounts;
  rows?: SlipRow[];
  unmatched?: SlipUnmatched[];
  /** needs_plan: the plan the sheet proposes. */
  planDraft?: PlanDraftRow[];
  photos?: { page: number; contentType: string; size: number }[];
}

/** One machine of the plan a sheet proposes when its shift has none. */
export interface PlanDraftRow {
  index: number;
  machine: string | null;
  machineID: string | null;
  machineRead: string | null;
  jobNo: string | null;
  operatorRead: string | null;
  employee: string | null;
  employeeName: string | null;
  match: "exact" | "close" | null;
  production: number | null;
  timer: string | null;
  notes: string[];
}

export interface PlanDraftEdit {
  index: number;
  include: boolean;
  employee: string | null;
}

export interface SlipEdit {
  index: number;
  include: boolean;
  production: number | string | null;
  timer: string | null;
  remarks: string;
}
