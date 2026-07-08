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
}
