import { OutsourcingRecord } from "./outsourcing";
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
  /**
   * false while the shift is still the operator's own claim. Until an
   * admin verifies it, `productionMeters` is what was submitted, not a
   * checked figure — and the two must not read alike.
   */
  verified?: boolean;
}

/**
 * What this job's shifts add up to.
 *
 * Saves the reader totting up rows by eye, and separates a verified
 * figure from one still awaiting verification — a claim and a checked
 * number are not the same fact.
 */
export interface JobShiftSummary {
  shifts: number;
  produced: number;
  workedMinutes: number;
  byShift: { DAY: number; NIGHT: number };
  closed: number;
  awaitingVerification: number;
  open: number;
  /** Output per hour actually worked, not per hour rostered. */
  metresPerHour: number;
  firstDate: string | null;
  lastDate: string | null;
  firstDateLabel: string | null;
  lastDateLabel: string | null;
}

export interface JobDetail {
  id: string;
  jobOrderNo: number;
  jobNo: string;
  date?: string;
  status: JobStatus;
  /** An outsourced job is made by a vendor and has no shifts of its own. */
  productionMode?: "in_house" | "outsource";
  outsourceVendor?: string;
  /** The vendor job-work record; null for in-house jobs. */
  outsourcing?: OutsourcingRecord | null;
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
  shiftSummary?: JobShiftSummary;
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
    /**
     * This job's share of what its order already drew from stock at
     * approval. A job only exists under an approved order, so without
     * it every job sheet reported a shortfall for yarn standing on the
     * floor for it.
     */
    allocated?: number;
    /** Requirement still to come out of stock: required − allocated. */
    outstanding?: number;
    inStock?: number;
    /**
     * Bought but not yet delivered — the outstanding quantity on open
     * purchase orders. Shown BESIDE the shortfall, never netted off it:
     * yarn on order is not yarn in the building, and treating it as
     * covered leaves a machine with nothing to run.
     */
    onOrder?: number;
    shortfall?: number;
    /**
     * The shortfall less what is already bought — what raising a PO
     * from here would order. Zero means the gap is real but already
     * purchased and waiting on delivery.
     */
    toBuy?: number;
    // false when the RawMaterial reference could not be resolved.
    stockKnown?: boolean;
    // Carried so a shortfall can be turned straight into a purchase
    // order; null when the material has no supplier and so cannot be
    // ordered at all.
    supplierId?: string | null;
    supplierName?: string;
    /**
     * The dye lots standing behind this material (utils/materialRequirement.js).
     *
     * Two different facts share the list, told apart by `committed`:
     * a lot this job's warping programme has already CHOSEN for a beam
     * section, and a lot that is merely AVAILABLE on the rack. Printing
     * them alike would put an operator on the wrong bag, so the sheet
     * says which.
     *
     * Only warp materials get one — nothing in the system ever chooses
     * a lot for anything else. Always an array, empty when there are
     * none, so a caller never guards a null.
     */
    lots?: Array<{
      yarnLot: string | null;
      lotNo: string;
      shade: string;
      /** Kg left. null for a committed lot no longer open. */
      balance: number | null;
      /** Days on the rack. null when the lot is not open. */
      ageDays: number | null;
      /** true when something has claimed this lot — see `source`. */
      committed: boolean;
      /**
       * WHICH decision put this lot on the sheet. Two different ones
       * both arrive as `committed`, and they are not the same claim:
       *
       *   order      the order set this bag aside when it was approved
       *              — made before any beam existed, and it is what the
       *              warping batch picker is measured against;
       *   programme  the warping plan chose it for a beam section,
       *              which is a decision about where in the cloth it
       *              goes;
       *   available  nothing has claimed it; it is simply open.
       *
       * They usually agree. When they do not, that disagreement is the
       * most useful thing this column can show, so it is not flattened.
       */
      source?: "order" | "programme" | "available";
      /** Kg the order set aside. Null unless `source` is "order". */
      quantity?: number | null;
    }>;
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
  /**
   * Where this row comes from, and the two are never merged.
   *
   * "planned" — chosen when the warping programme was written. Says
   *   which lot the beam is meant to run off. It can still change.
   * "issued"  — drawn against a warping batch. The cones are off the
   *   rack; this one cannot change.
   */
  source: "planned" | "issued";
  /** Set on planned rows only. */
  planId?: string | null;
  batchId: string | null;
  batchNo: string | null;
  batchStatus: "planned" | "issued" | "completed" | null;
  beamNos: number[];
  yarnLot: string;
  lotNo: string;
  shade: string;
  /** The lot's own state — a lot quarantined after programming matters. */
  lotStatus?: string | null;
  materialName: string;
  /** null on a planned row: programming names the lot, it does not weigh it. */
  quantity: number | null;
  /** How many beam sections a planned lot covers. */
  sections?: number;
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

/** How many of the programme's beam sections have a lot on them yet. */
export interface LotSectionCount {
  total: number;
  withLot: number;
  open: number;
}

export interface JobYarnLots {
  jobId: string;
  jobOrderNo: number;
  byElastic: JobLotGroup[];
  lots: Array<{
    yarnLot: string;
    lotNo: string;
    shade: string;
    materialName: string;
    source: "planned" | "issued";
  }>;
  sections: LotSectionCount;
  /** Beams with at least one section still awaiting a lot. */
  openBeamNos: number[];
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
