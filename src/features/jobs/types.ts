export type JobStatus =
  | "preparatory"
  | "weaving"
  | "finishing"
  | "checking"
  | "packing"
  | "completed"
  | "cancelled";

export const JOB_STATUSES: JobStatus[] = [
  "preparatory",
  "weaving",
  "finishing",
  "checking",
  "packing",
  "completed",
  "cancelled",
];

export const JOB_PIPELINE: JobStatus[] = [
  "preparatory",
  "weaving",
  "finishing",
  "checking",
  "packing",
  "completed",
];

export interface JobListItem {
  _id: string;
  jobOrderNo: number;
  status: JobStatus;
  date?: string;
  customer?: { name: string } | null;
  machine?: { ID: string; status?: string } | null;
  createdAt?: string;
}

export interface ElasticQty {
  elasticId: string | null;
  elasticName: string;
  quantity: number;
}

export interface JobShiftDetail {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT";
  status: string;
  timer: string;
  productionMeters: number;
  machineName: string;
  operatorName: string;
  operatorDept?: string;
  elastics: Array<{ head: number; elasticName: string }>;
}

export interface JobDetail {
  id: string;
  jobOrderNo: number;
  jobNo: string;
  date?: string;
  status: JobStatus;
  customerName: string;
  orderNo?: number | string;
  machine?: {
    machineId: string;
    machineName: string;
    machineNoOfHead: number;
    manufacturer?: string;
    status?: string;
  } | null;
  plannedElastics: ElasticQty[];
  producedElastics: ElasticQty[];
  packedElastics: ElasticQty[];
  wastageElastics: ElasticQty[];
  warping?: { status: string; date?: string | null } | null;
  covering?: { status: string; date?: string | null } | null;
  shiftDetails: JobShiftDetail[];
  wastages: Array<{
    id: string;
    elasticName: string;
    employeeName: string;
    quantity: number;
    penalty: number;
    reason: string;
    date?: string;
  }>;
  packingDetails: Array<{
    id: string;
    elasticName: string;
    quantity: number;
    rolls: number;
    metersPerRoll: number;
    total: number;
    batch: string;
    status: string;
    date?: string;
  }>;
}

export interface JobSummaryRow {
  elasticId: string;
  elasticName: string;
  planned: number;
  produced: number;
  packed: number;
  wasted: number;
  remaining: number;
  packingPct: number;
}

export interface MrpData {
  jobId: string;
  jobOrderNo: number;
  orderNo?: number | null;
  customerName: string;
  dateLabel: string;
  status: string;
  productionMode: "in_house" | "outsource";
  outsourceVendor?: string;
  elastics: Array<{ name: string; quantity: number }>;
  materials: Array<{
    id?: string;
    // The RawMaterial reference, as utils/materialRequirement.js names it.
    rawMaterial?: string;
    unitPrice?: number;
    name?: string;
    materialName?: string;
    category?: string;
    required?: number;
    quantity?: number;
    stock?: number;
    available?: number;
    unit?: string;
    // Actual backend field names (utils/materialRequirement.js).
    requiredWeight?: number;
    inStock?: number;
    shortfall?: number;
    // false when the RawMaterial reference could not be resolved.
    stockKnown?: boolean;
    // Carried so a shortfall can be turned straight into a purchase
    // order; null when the material has no supplier and so cannot be
    // ordered at all.
    supplierId?: string | null;
    supplierName?: string;
  }>;
}

// ── Raising POs from the shortfall ──────────────────────────────────────
export interface RaisedPo {
  poId: string;
  poNo: number;
  supplierId: string;
  supplierName: string;
  lines: Array<{ rawMaterial: string; name: string; quantity: number; price: number }>;
  value: number;
}

export interface RaisePoResult {
  success: boolean;
  purchaseOrders: RaisedPo[];
  /** Short materials that could not be ordered, and why. Never silent. */
  skipped: Array<{ rawMaterial: string; name: string; reason: string }>;
}

/** A PO already raised against this job — what is on order to cover it. */
export interface JobPurchaseOrder {
  _id: string;
  poNo?: number;
  status: string;
  createdAt?: string;
  expectedDate?: string;
  supplier?: { _id: string; name: string } | null;
  items: Array<{
    rawMaterial?: { _id: string; name: string } | string;
    quantity: number;
    receivedQuantity?: number;
    price?: number;
  }>;
}

// ── Yarn lots behind a job ───────────────────────────────────────────────
// The backward half of lot traceability: /yarn-lots/:id/trace answers
// "where did this lot go", this answers "what is in this roll" — the
// question actually asked when a customer reports a shade band months on.
export interface JobLotUse {
  batchId: string;
  batchNo: string;
  batchStatus: "planned" | "issued" | "completed";
  beamNos: number[];
  yarnLot: string;
  lotNo: string;
  shade: string;
  materialName: string;
  quantity: number;
  /**
   * How many elastics this one draw is answering for. The batch drew its
   * yarn once, so the quantity is left whole rather than divided by a
   * split nobody measured.
   */
  sharedAcross: number;
  issuedDate: string | null;
}

export interface JobLotGroup {
  /** null for batches never attributed to a particular elastic. */
  elasticId: string | null;
  elasticName: string;
  lots: JobLotUse[];
}

export interface JobYarnLots {
  jobId: string;
  jobOrderNo: number;
  byElastic: JobLotGroup[];
  lots: Array<{ yarnLot: string; lotNo: string; shade: string; materialName: string }>;
  hasUnattributed: boolean;
}

// ── Readiness to leave preparatory ───────────────────────────────────────
// A job is prepared when BOTH its warping and its covering are completed.
// The server refuses the move otherwise (409 WEAVING_NOT_READY) and hands
// back these blockers so the UI can say which stage is holding it up.
export interface WeavingStageReadiness {
  stage: "warping" | "covering";
  linked: boolean;
  status: string | null;
  done: boolean;
}

export interface WeavingReadiness {
  ready: boolean;
  jobStatus: JobStatus | "unknown";
  stages: WeavingStageReadiness[];
  blockers: string[];
}

/**
 * What /plan-weaving and /assign-machine answer with.
 *
 * The machine is claimed either way — reserving capacity before
 * preparation finishes is legitimate. `weavingHeld` is present when the
 * status was withheld because warping or covering is still running, and
 * carries the reasons; the job advances on its own once they finish.
 */
export interface MachineAssignResult {
  success: boolean;
  message: string;
  weavingHeld: { blockers: string[] } | null;
}
