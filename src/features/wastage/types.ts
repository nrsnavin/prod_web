export interface WastageJobRow {
  _id: string;
  jobOrderNo: number;
  status: string;
  customer?: { name?: string } | null;
  totalWastage: number;
  wastageCount: number;
  lastAdded?: string;
}

export interface WastageRecord {
  _id: string;
  elastic?: { _id: string; name: string } | string | null;
  employee?: { _id: string; name: string } | string | null;
  quantity: number;
  penalty?: number;
  reason: string;
  createdAt?: string;
}

// A weaving operator who worked a shift on a given job — the candidates
// for the "employee" field when recording that job's wastage.
export interface JobOperator {
  _id: string;
  name: string;
  department?: string;
}

export interface WastageEligibleJob {
  _id: string;
  jobOrderNo: number;
  status: string;
  customer?: { name?: string } | null;
  elastics?: Array<{ elastic: { _id: string; name: string } | string | null; quantity: number }>;
}

export interface WastageAnalytics {
  topEmployees: Array<{ name: string; department?: string; total: number; count: number }>;
  byElastic: Array<{ name: string; total: number; count: number }>;
  byStatus: Array<{ _id: string; total: number; count: number }>;
  trend: Array<{ date: string; total: number; count: number }>;
  totalWastage: number;
  totalPenalty: number;
  totalCount: number;
  days: number;
}

export interface WastageFormValues {
  job: string;
  elastic: string;
  employee: string;
  quantity: number;
  penalty?: number;
  reason: string;
  incidentDate?: string;
}

export interface WastageRootCause {
  success: boolean;
  days: number;
  totals: { qty: number; count: number; penalty: number };
  byReason: Array<{ reason: string; qty: number; count: number; penalty: number }>;
  byOperator: Array<{ name: string; department?: string; qty: number; count: number }>;
  byElastic: Array<{ name: string; qty: number; count: number }>;
  byMachine: Array<{ machineID: string; qty: number; count: number }>;
  reasonMachine: Array<{ reason: string; machineID: string; qty: number; count: number }>;
  reasonOperator: Array<{ reason: string; operator: string; qty: number; count: number }>;
  insights: Array<{ severity: "info" | "warn"; title: string; detail: string }>;
  aiSummary: string | null;
  aiGenerated: boolean;
}
