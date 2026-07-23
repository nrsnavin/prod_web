export interface ShiftPlanMachineRow {
  machineId: string;
  machineName: string;
  jobOrderNo?: string | number;
  operatorName: string;
  production: number;
  timer?: string;
  status: string;
  // The ShiftDetail id — the target of verify-production when an admin
  // enters output for an open row. (`shiftPlanById` returns it as `id`.)
  id: string;
}

export interface ShiftPlanDetail {
  _id: string;
  date: string;
  shift: "DAY" | "NIGHT";
  description?: string;
  totalProduction: number;
  operatorCount: number;
  machines: ShiftPlanMachineRow[];
}

export interface TodayShiftSummary {
  id?: string;
  shift: "DAY" | "NIGHT";
  status?: string; // "not_created" when missing
  production?: number;
  machinesRunning?: number;
  operatorCount?: number;
  plan?: unknown[];
}

export interface PendingShift {
  _id: string;
  productionMeters?: number;
  // The values the worker/OCR submitted — populated while status is
  // pending_verification. `productionMeters` stays 0 until an admin verifies.
  submittedProductionMeters?: number;
  submittedTimer?: string;
  submittedFeedback?: string;
  timer?: string;
  submittedAt?: string;
  feedback?: string;
  employee?: { _id: string; name: string; department?: string } | null;
  machine?: {
    _id: string;
    ID?: string;
    orderRunning?: {
      jobOrderNo?: number;
      customer?: { name?: string } | null;
      order?: { po?: string; orderNo?: number } | null;
    } | null;
  } | null;
  shiftPlan?: { date?: string; shift?: "DAY" | "NIGHT" } | null;
  job?: {
    _id: string;
    jobOrderNo?: number;
    customer?: { name?: string } | null;
  } | null;
}

export interface ShiftPlanFormValues {
  date: string;
  shiftType: "DAY" | "NIGHT";
  description?: string;
  machines: Array<{ machine: string; operator: string; jobOrderNo: number }>;
}

// Production date-range view
export interface ProductionShiftSlice {
  exists: boolean;
  shiftPlanId?: string;
  machineCount?: number;
  operatorCount?: number;
  shiftDetailCount?: number;
  production?: number;
  description?: string;
  statusSummary?: "none" | "open" | "running" | "closed";
}

export interface ProductionDay {
  date: string;
  dateLabel: string;
  dayOfWeek: string;
  hasData: boolean;
  totalProduction: number;
  dayShift: ProductionShiftSlice;
  nightShift: ProductionShiftSlice;
}

export interface RunningMachineOption {
  machineId: string;
  ID: string;
  machineCode?: string;
  manufacturer?: string;
  jobOrderNo?: string | number;
}
