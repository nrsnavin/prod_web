export type OrderStatus = "Open" | "Approved" | "InProgress" | "Completed" | "Cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "Open",
  "Approved",
  "InProgress",
  "Completed",
  "Cancelled",
];

export interface OrderListItem {
  _id: string;
  orderNo: number;
  po?: string;
  status: OrderStatus;
  date?: string;
  supplyDate?: string;
  customer?: { _id?: string; name: string } | null;
  createdAt?: string;
}

export interface OrderElasticProgress {
  id: string;
  name: string;
  ordered: number;
  produced: number;
  packed: number;
  pending: number;
}

export interface OrderJobRef {
  job?: string;
  no?: number;
  _id?: string;
  jobOrderNo?: number;
  status?: string;
}

export interface RawMaterialRequirement {
  id?: string;
  name?: string;
  material?: { _id: string; name: string } | string;
  quantity?: number;
  required?: number;
  available?: number;
  stock?: number;
  unit?: string;
}

export interface OrderDetail {
  _id: string;
  orderNo: number;
  po?: string;
  status: OrderStatus;
  date?: string;
  supplyDate?: string;
  description?: string;
  customer?: { _id?: string; name: string; gstin?: string } | null;
  elastics: OrderElasticProgress[];
  jobs: OrderJobRef[];
  rawMaterialRequired: RawMaterialRequirement[];
}

export interface OrderFormValues {
  date: string;
  po: string;
  customer: string;
  supplyDate: string;
  description?: string;
  elasticOrdered: Array<{ elastic: string; quantity: number }>;
}

// Mirrors POST /api/v2/order/estimate-completion (utils/orderEta.js)
export interface EtaWhatIf {
  machines: number;
  workingDays: number;
  expectedDate: string;
}

export interface OrderEtaEstimate {
  success: boolean;
  ok?: boolean;
  reason?: string;
  expectedDate?: string;
  workingDays?: number;
  weavingDays?: number;
  leadDays?: number;
  machineDays?: number;
  machines?: number; // recommended machine count
  totalMeters?: number;
  effRate?: number; // metres / machine-day
  confidence?: number; // 0..1
  optimistic?: string;
  pessimistic?: string;
  optimisticDays?: number;
  pessimisticDays?: number;
  risk?: { late: boolean; lateWorkingDays: number; supplyDate?: string } | null;
  whatIf?: EtaWhatIf[];
  usedColdStart?: boolean;
  assumptions?: string[];
  perLineRates?: Array<{ elastic: string; meters: number; rate: number; source: string }>;
  aggregates?: {
    plantRate: number | null;
    freeMachines: number;
    totalMachines: number;
    availableMachines: number;
    machineDaysSampled: number;
    consistencyScore: number;
  };
}
