export type MachineStatus = "free" | "running" | "maintenance";

export interface Machine {
  _id: string;
  ID: string;
  manufacturer: string;
  NoOfHead: number;
  NoOfHooks: number;
  DateOfPurchase?: string;
  status: MachineStatus;
  /**
   * The job this machine is on, populated by the list and detail
   * routes. `string` is the unpopulated shape — kept in the union
   * because a route that forgets to populate returns a bare id, and
   * rendering that as a job number would be worse than a dash.
   */
  orderRunning?:
    | { _id?: string; jobOrderNo?: number | string; status?: string }
    | string
    | null;
}

export interface ServiceLog {
  _id?: string;
  date: string;
  type: "Preventive" | "Corrective" | "Breakdown" | "Inspection" | "Other";
  description: string;
  technician?: string;
  cost?: number;
  nextServiceDate?: string | null;
  resolved?: boolean;
  /** Rollup of the attached bills, so the history renders in one request. */
  billCount?: number;
  billTotal?: number;
}

export type ServiceBillKind = "service_bill" | "spare_bill";

/** A bill filed against a service log. The file itself is fetched on demand. */
export interface ServiceBill {
  _id: string;
  machine: string;
  serviceLog: string;
  kind: ServiceBillKind;
  filename: string;
  contentType: string;
  size: number;
  amount: number;
  vendor?: string;
  billNo?: string;
  billDate?: string | null;
  partName?: string;
  notes?: string;
  createdAt: string;
}

export interface ServiceBillUpload {
  machineId: string;
  serviceLogId: string;
  kind: ServiceBillKind;
  file: File;
  amount?: number;
  vendor?: string;
  billNo?: string;
  billDate?: string;
  partName?: string;
  notes?: string;
}

export type ShiftDetailStatus = "open" | "running" | "pending_verification" | "closed";

export interface MachineShiftRow {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT";
  /** Until this is "closed" the figures are the operator's own, unverified. */
  status: ShiftDetailStatus;
  employee: string;
  runtimeMinutes: number;
  outputMeters: number;
  efficiency: number;
}

// One head of the loom and the elastic threaded on it.
export interface MachineHeadElastic {
  head: number | null;
  elastic: { _id: string; name: string | null } | null;
}

export interface MachineDetail {
  id: string; // Machine.ID (display code)
  status: MachineStatus;
  manufacturer: string;
  heads: number;
  hooks: number;
  dateOfPurchase?: string | null;
  currentJobNo?: string | null;
  currentJob?: { id: string | null; jobOrderNo: number | null } | null;
  elastics: MachineHeadElastic[];
  result: MachineShiftRow[];
  serviceLogs: ServiceLog[];
}

export interface MaintenanceDueItem {
  machineId: string;
  ID: string;
  manufacturer: string;
  status: MachineStatus;
  nextServiceDate: string;
  lastServiceType?: string;
  lastServiceDate?: string;
  overdue: boolean;
  daysUntil: number;
}

export type HealthBand = "healthy" | "watch" | "at_risk";

export interface MachineHealthReason {
  severity: "low" | "medium" | "high";
  label: string;
  detail: string;
}

export interface MachineHealth {
  machineId: string;
  machineID: string;
  status: MachineStatus;
  score: number;
  band: HealthBand;
  dropPct: number;
  issues30d: number;
  openIssues: number;
  recentAvg: number | null;
  baselineAvg: number | null;
  nextServiceDate?: string | null;
  reasons: MachineHealthReason[];
}

export interface MachineHealthResponse {
  success: boolean;
  generatedAt: string;
  summary: { total: number; atRisk: number; watch: number };
  machines: MachineHealth[];
}

export interface MachineFormValues {
  ID: string;
  manufacturer: string;
  NoOfHead: number;
  NoOfHooks: number;
  DateOfPurchase?: string;
}

/**
 * The editable details of a machine. Every field optional on purpose:
 * the route writes only what it is given, so a dialog that changed one
 * field sends one field.
 *
 * `NoOfHead` is deliberately absent — it has its own route and its own
 * dialog, because it re-prices work in progress and needs its own
 * conversation.
 */
export interface MachineDetailsPatch {
  ID?: string;
  manufacturer?: string;
  NoOfHooks?: number;
  /** `null` clears it — an unknown purchase date is better than a guess. */
  DateOfPurchase?: string | null;
}

/** One field the server actually changed, read back from stored values. */
export interface MachineDetailChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export interface MachineDetailsUpdateResult {
  success: boolean;
  message: string;
  changes: MachineDetailChange[];
}

export interface ServiceLogFormValues {
  type: ServiceLog["type"];
  description: string;
  technician?: string;
  cost?: number;
  nextServiceDate?: string;
  /** Take the machine off the floor as part of booking the work in. */
  setMaintenance?: boolean;
}

// ══════════════════════════════════════════════════════════════════
//  SERVICE SPENDING, AND THE PATTERNS WORTH A LOOK
//
//  `findings` are OBSERVATIONS, never verdicts. Every one carries the
//  innocent reading that is usually the true one, and the UI is
//  required to show it — see services/serviceAnomaly.js on the server
//  for why that is a design rule rather than a nicety.
// ══════════════════════════════════════════════════════════════════

export interface SpendMonth {
  month: string;        // "2026-08"
  total: number;
  labour: number;
  parts: number;
  services: number;
}

export interface ServiceSpend {
  windowDays: number;
  series: SpendMonth[];
  total: number;
  services: number;
  /** Median month. One rebuild must not become the budget figure. */
  typicalMonth: number;
  meanMonth: number;
  byType: Array<{ type: string; amount: number }>;
  byTechnician: Array<{ technician: string; amount: number }>;
}

export type FindingKind =
  | "repeat-service"
  | "issue-across-machines"
  | "technician-cost"
  | "duplicate-bill-no"
  | "duplicate-bill-amount"
  | "cost-mismatch";

export interface ServiceFinding {
  kind: FindingKind;
  subject: string;
  /** 0..1. Ranking only — it is not a probability of anything. */
  severity: number;
  title: string;
  detail: string;
  /** The reading that is usually true. Always shown beside the finding. */
  innocent: string;
  evidence: Array<Record<string, unknown>>;
}

export interface ServiceAnomalies {
  /** False when there is too little history to say anything at all. */
  ready: boolean;
  reason?: string;
  windowDays: number;
  services: number;
  dismissed?: number;
  findings: ServiceFinding[];
}

export interface CostliestMachine {
  machineId: string;
  machineID: string;
  total: number;
  services: number;
  perService: number;
  lastServiced: string | null;
}

export interface ServiceAnalytics {
  days: number;
  spend: ServiceSpend;
  anomalies: ServiceAnomalies;
  costliest: CostliestMachine[];
}

export interface ProductionMonth {
  month: string;
  meters: number;
  shifts: number;
  runtimeHours: number;
}

export interface ProductionSeries {
  days: number;
  series: ProductionMonth[];
  totalMeters: number;
  totalShifts: number;
}
