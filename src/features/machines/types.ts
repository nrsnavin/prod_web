export type MachineStatus = "free" | "running" | "maintenance";

export interface Machine {
  _id: string;
  ID: string;
  manufacturer: string;
  NoOfHead: number;
  NoOfHooks: number;
  DateOfPurchase?: string;
  status: MachineStatus;
  orderRunning?: { jobOrderNo?: number | string } | string | null;
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
}

export interface MachineShiftRow {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT";
  employee: string;
  runtimeMinutes: number;
  outputMeters: number;
  efficiency: number;
}

export interface MachineDetail {
  id: string; // Machine.ID (display code)
  status: MachineStatus;
  manufacturer: string;
  heads: number;
  hooks: number;
  dateOfPurchase?: string | null;
  currentJobNo?: string | null;
  elastics: unknown[];
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

export interface ServiceLogFormValues {
  type: ServiceLog["type"];
  description: string;
  technician?: string;
  cost?: number;
  nextServiceDate?: string;
}
