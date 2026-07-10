// Mirrors GET /api/v2/production/breakdown (prod/api/production.js)

export type GroupDim = "machine" | "operator" | "customer" | "order" | "elastic" | "group";

export type InsightSeverity = "good" | "info" | "warn";

export interface Insight {
  severity: InsightSeverity;
  title: string;
  detail: string;
}

export interface BreakdownRow {
  key: string;
  label: string;
  sublabel: string;
  production: number;
  shiftCount: number;
  avgPerShift: number;
  wastageQty: number;
  wastageEvents: number;
  wastagePenalty: number;
  wastageRate: number; // % of (production + wastage)
  share: number; // % of total production
}

export interface BreakdownTotals {
  production: number;
  shiftCount: number;
  wastageQty: number;
  wastageEvents: number;
  wastagePenalty: number;
  wastageRate: number;
}

export interface BreakdownResponse {
  success: boolean;
  groupBy: GroupDim;
  range: { start: string; end: string };
  totals: BreakdownTotals;
  rows: BreakdownRow[];
  insights: Insight[];
}

export interface BreakdownParams {
  start: string;
  end: string;
  groupBy: GroupDim;
  shift: "all" | "DAY" | "NIGHT";
  machineId?: string;
  customerId?: string;
}

// ── AI delivery forecast (running ETA) ──────────────────────────

export interface EtaRateSources {
  posterior: number;
  plant: number;
  coldstart: number;
  missing: number;
}

export interface BulkEta {
  ok: boolean;
  reason?: string;
  status?: string;
  expectedDate?: string;
  workingDays?: number;
  weavingDays?: number;
  leadDays?: number;
  late?: boolean;
  lateWorkingDays?: number;
  rateSources?: EtaRateSources;
}

export interface RunningEta extends BulkEta {
  perJob?: Array<{
    job: string;
    jobOrderNo?: number;
    machineLabel?: string | null;
    weavingDays?: number;
    hasMissingRate?: boolean;
  }>;
  risk?: { late: boolean; lateWorkingDays: number; promised?: string } | null;
  assumptions?: string[];
  usedEntryTimeFallback?: boolean;
}
