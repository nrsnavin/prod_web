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
   * Goods that have actually left the building on a delivery note.
   *
   * A step past `packed`, and constantly read as the same thing: an
   * order can be fully packed with nothing despatched. Summed from the
   * notes rather than stored, so it cannot drift from them; cancelled
   * notes count for nothing.
   */
  delivered: number;
  /** ordered − delivered. Negative on an over-despatch, deliberately. */
  undelivered: number;
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
  /** Held for this order at approval; 0 before it and after a cancel. */
  allocated?: number;
  /** Still to be drawn — what `stockSufficient` is measured against. */
  outstanding?: number;
  /**
   * full    — the whole requirement is held for this order
   * partial — a forced approval took what there was; the rest is owed
   *           and nothing is holding it
   * none    — not approved yet, or a cancel handed the stock back
   */
  allocationState?: "none" | "partial" | "full";
  available?: number;
  inStock?: number;
  stock?: number;
  stockSufficient?: boolean;
  unit?: string;
}

export interface OrderDetail {
  _id: string;
  /**
   * Mongoose's document version. Sent back as `expectedVersion` on an
   * edit so a second editor gets a 409 rather than silently overwriting
   * the first, and used to key the edit form so it reloads its fields
   * after a save instead of keeping the ones it mounted with.
   */
  __v?: number;
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
  /** Jobs planned past what this order asked for. Empty when none. */
  excessPlanning: ExcessPlanningRow[];
}

/**
 * One job planning more of an elastic than the order asked for.
 *
 * Up to 20% over is allowed with no comment; past that the planner had
 * to give a reason, which is kept here. `reason: ""` therefore means
 * "inside the allowance, never asked" — not "withheld".
 *
 * `materialsDrawn` is the yarn the excess took out of stock, over and
 * above what the order's approval already deducted.
 */
export interface ExcessPlanningRow {
  elastic: string;
  name: string;
  job: string;
  jobOrderNo: number | null;
  jobNo: string;
  orderedQuantity: number;
  plannedQuantity: number;
  excessQuantity: number;
  excessPct: number;
  reason: string;
  materialsDrawn: Array<{ rawMaterial: string; name: string; quantity: number }>;
  recordedAt: string | null;
}

/** Structured body of an EXCESS_PLANNING_REASON_REQUIRED 409. */
export interface ExcessPlanningPrompt {
  freeExcessPct: number;
  lines: Array<{
    elastic: string;
    name: string;
    ordered: number;
    totalPlanned: number;
    excess: number;
    excessPct: number;
  }>;
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
  /**
   * Held for this order — approval takes the requirement out of stock
   * there and then. `inStock` no longer contains it, so comparing it
   * against the full requirement reported an order as short of the
   * very yarn it was standing on.
   */
  allocated?: number;
  /** Requirement still to come out of stock: required − allocated. */
  outstanding?: number;
  inStock?: number;
  /**
   * Bought but not yet delivered — outstanding on open purchase orders.
   * Shown BESIDE the shortfall, never netted off it: yarn on order is
   * not yarn in the building, and treating it as covered leaves a
   * machine with nothing to run.
   */
  onOrder?: number;
  shortfall?: number;
  /**
   * The shortfall less what is already bought — what raising a PO from
   * here would actually order. Zero means the gap is real but the
   * purchase order for it already exists.
   */
  toBuy?: number;
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

// ── Dye lots on an order ─────────────────────────────────────────────────
// Shade complaints arrive quoting an order or a delivery note, not a
// warping batch, so the lot trail has to be answerable from this end.
// Rolled up per job: what each job's warping programme committed to, and
// what its batches actually issued.
export interface OrderLotRow {
  /** "planned" can still change; "issued" is yarn already off the rack. */
  source: "planned" | "issued";
  yarnLot: string | null;
  lotNo: string;
  shade: string;
  materialName: string;
  beamNos: number[];
  /** Planned rows only — how many beam sections run off this lot. */
  sections?: number;
  /** Issued rows only — kg drawn. Programming does not weigh a lot. */
  quantity?: number;
  batchNo?: string;
  batchStatus?: string;
  elasticNames?: string[];
  elasticName?: string | null;
  lotStatus?: string | null;
  issuedDate?: string | null;
}

export interface OrderLotJob {
  jobId: string;
  jobOrderNo: number;
  jobNo: string;
  status: string;
  elastics: string[];
  planned: OrderLotRow[];
  issued: OrderLotRow[];
  sections: { total: number; withLot: number; open: number };
  openBeamNos: number[];
}

export interface OrderYarnLots {
  orderId: string;
  orderNo: number | null;
  byJob: OrderLotJob[];
  lots: Array<{
    yarnLot: string | null;
    lotNo: string;
    shade: string;
    materialName: string;
    source: "planned" | "issued";
  }>;
  sections: { total: number; withLot: number; open: number };
}


// ── Delivery notes raised for the order ─────────────────────────────
// The order detail page could say what was ordered, planned, produced
// and packed, and then stopped. Whether any of it had been DESPATCHED
// was only answerable by leaving the order and searching the DC list.

export type DcStatus = "draft" | "dispatched" | "delivered" | "cancelled";

export interface OrderDcItem {
  elasticId: string | null;
  elasticName: string;
  quantity: number;
  unit: string;
}

export interface OrderDcRow {
  id: string;
  dcNumber: string;
  date: string | null;
  dispatchDate: string | null;
  status: DcStatus;
  type: string;
  customerName: string;
  totalQuantity: number;
  totalAmount: number;
  vehicleNo: string;
  transporter: string;
  lrNumber: string;
  items: OrderDcItem[];
}

/** Ordered against despatched, per elastic on the order. */
export interface OrderDcLine {
  elasticId: string;
  elasticName: string;
  ordered: number;
  dispatched: number;
  /** ordered − dispatched. Negative when more went out than was ordered. */
  pending: number;
}

export interface OrderDeliveryChallans {
  orderId: string;
  orderNo: number | null;
  dcs: OrderDcRow[];
  lines: OrderDcLine[];
  totals: {
    count: number;
    /** How many of `count` are cancelled — listed, but nothing left on them. */
    cancelled: number;
    quantity: number;
    ordered: number;
    dispatched: number;
  };
}

// ══════════════════════════════════════════════════════════════════
//  INBOUND PO INTAKE — mirrors services/inboundPoIntake.js
//
//  A draft read from a customer's document. Nothing is created by the
//  endpoint that returns this; the order form is still what writes.
// ══════════════════════════════════════════════════════════════════

export interface PoMatchCandidate { id: string; name: string; score: number }

export interface PoIntakeLine {
  /** Verbatim from the document — the thing to check against. */
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  confidence: number;
  match: {
    elasticId: string | null;
    elasticName: string | null;
    candidates: PoMatchCandidate[];
    /** Preselected only when strong AND clearly ahead of the runner-up. */
    confident: boolean;
    /** Withheld because the width disagrees — shown, never silent. */
    blockedByWidth: Array<{ name: string; reason: string }>;
  };
}

export interface PoIntakeResult {
  success: boolean;
  available?: boolean;
  ok?: boolean;
  message?: string;
  aiSuggestionId?: string | null;
  model?: string;
  draft?: {
    customerName: string | null;
    poNumber: string | null;
    poDate: string | null;
    deliveryDate: string | null;
    currency: string | null;
    notes: string;
    confidence: number;
    lines: PoIntakeLine[];
    customer: {
      customerId: string | null;
      customerName: string | null;
      candidates: PoMatchCandidate[];
      confident: boolean;
    };
  };
  summary: { lines: number; matched: number; needsAttention: number; customerMatched: boolean };
  disclaimer: string;
}
