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
