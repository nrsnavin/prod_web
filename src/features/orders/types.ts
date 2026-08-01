export type OrderStatus = "Open" | "Approved" | "InProgress" | "Completed" | "Cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "Open",
  "Approved",
  "InProgress",
  "Completed",
  "Cancelled",
];

// The orders list can also filter on "All" (every status). Kept separate
// from OrderStatus so status-keyed maps and item statuses stay exhaustive.
export type OrderFilter = "All" | OrderStatus;

export const ORDER_FILTERS: OrderFilter[] = ["All", ...ORDER_STATUSES];

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

/** One page of /order/list. `total` is the count matching the filter. */
export interface OrderListPage {
  success: boolean;
  orders: OrderListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface OrderElasticProgress {
  id: string;
  name: string;
  ordered: number;
  produced: number;
  packed: number;
  /**
   * Ordered less what jobs have been raised for — a PLANNING figure,
   * and the cap when allocating to a job.
   */
  notAssigned: number;
  /**
   * Ordered less packed — a DELIVERY figure: what the customer is still
   * owed. A line can be fully assigned to jobs and entirely pending,
   * which is why one number could not answer both.
   */
  pendingDelivery: number;
  /** @deprecated Legacy alias for `notAssigned`. Prefer the named ones. */
  pending: number;
}

// A populated JobOrder as returned by `get-orderDetail` (which does
// `.populate("jobs.job")`). Before population `job` is just the id string.
export interface PopulatedJob {
  _id: string;
  jobOrderNo?: number;
  status?: string;
}

/**
 * One elastic inside a job. `pending` here means "committed to this job but
 * not yet woven" (planned − produced) — a different question from the
 * order-level pending, which means "not yet committed to any job".
 */
export interface JobElasticSummary {
  id: string;
  name: string;
  planned: number;
  produced: number;
  packed: number;
  pending: number;
}

export interface OrderJobRef {
  // Populated to the JobOrder document by the detail endpoint; a bare id
  // string when unpopulated.
  job?: string | PopulatedJob;
  no?: number;
  _id?: string;
  jobOrderNo?: number;
  status?: string;
  /** Per-elastic breakdown; absent when the job ref wasn't populated. */
  elasticSummary?: JobElasticSummary[];
}

export interface RawMaterialRequirement {
  id?: string;
  name?: string;
  material?: { _id: string; name: string } | string;
  rawMaterial?: string;
  quantity?: number;
  required?: number;
  // The order-detail endpoint returns the requirement as `requiredWeight`
  // (kg) and current stock as `inStock`; the older `required`/`available`
  // names are kept as fallbacks for other callers.
  requiredWeight?: number;
  available?: number;
  inStock?: number;
  stock?: number;
  stockSufficient?: boolean;
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

// Structured payload the backend attaches to an INSUFFICIENT_STOCK 400
// when an Open order is approved while a raw material is short. The
// force-approve dialog renders it so the admin sees what they override.
export interface StockShortfall {
  materialId: string;
  materialName: string;
  available: number;
  required: number;
  short: number;
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


// ── Order-level material requirement ────────────────────────────────────
export interface OrderMrpMaterial {
  rawMaterial?: string;
  name?: string;
  category?: string;
  requiredWeight?: number;
  inStock?: number;
  /**
   * Bought but not yet delivered — outstanding on open purchase orders.
   * Shown BESIDE the shortfall, never netted off it: yarn on order is
   * not yarn in the building, and treating it as covered leaves a
   * machine with nothing to run.
   */
  onOrder?: number;
  shortfall?: number;
  unitPrice?: number;
  stockKnown?: boolean;
  supplierId?: string | null;
  supplierName?: string;
}

export interface OrderMrp {
  orderId: string;
  orderNo: number | null;
  customerPo: string;
  customerName: string;
  status: string;
  materials: OrderMrpMaterial[];
}

export interface RaisePoResult {
  success: boolean;
  purchaseOrders: Array<{
    poId: string;
    poNo: number;
    supplierId: string;
    supplierName: string;
    lines: Array<{ rawMaterial: string; name: string; quantity: number; price: number }>;
    value: number;
  }>;
  /** Short materials that could not be ordered, and why. Never silent. */
  skipped: Array<{ rawMaterial: string; name: string; reason: string }>;
}

export interface OrderPurchaseOrder {
  _id: string;
  poNo?: number;
  status: string;
  supplier?: { _id: string; name: string } | null;
  forJob?: { _id: string; jobOrderNo: number } | null;
  items: Array<{ quantity: number }>;
}
