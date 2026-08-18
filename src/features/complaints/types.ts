export const COMPLAINT_CATEGORIES = [
  "shade", "strength", "width", "finish", "quantity", "packing", "delivery", "other",
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_STATUSES = [
  "Open", "InReview", "Resolved", "Rejected", "Closed",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface ComplaintRow {
  _id: string;
  date: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  reason: string;
  feedback?: string;
  resolution?: string;
  customer?: { _id: string; name: string } | null;
  elastic?: { _id: string; name: string } | null;
  job?: { _id: string; jobNo?: number; order?: { orderNo?: number } | null } | null;
}

/** One yarn lot the complained-of job is committed to. */
export interface TracedLot {
  yarnLot: string | null;
  lotNo: string;
  shade: string;
  materialName: string;
  /** `planned` can still be changed; `issued` has come off the rack. */
  source: "planned" | "issued";
  elasticIds: string[];
  elasticNames: string[];
  /** `job-wide` lots were recorded without naming an elastic. */
  attribution: "elastic" | "job-wide";
}

/**
 * Another job carrying one of the same lots.
 *
 * `certain` is false where a delivery challan matched the order and the
 * product but the order carries more than one job for that product —
 * the challan belongs to one of them and the data does not say which.
 */
export interface ExposureRow {
  jobId: string;
  jobNo: number | null;
  jobStatus: string;
  finishedNotShipped: boolean;
  orderId: string | null;
  orderNo: number | null;
  customerId: string | null;
  customerName: string;
  elastics: { id: string; name: string }[];
  exposure: "delivered" | "inTransit" | "inHouse";
  certain: boolean;
  via: ("planned" | "issued")[];
  challans: { dcNumber: string; status: string; date: string | null }[];
}

export interface TraceResult {
  ok: boolean;
  reason?: string;
  message?: string;
  complaint?: {
    complaintId: string;
    date: string;
    category: string;
    status: string;
    reason: string;
    customerName: string;
    jobNo: number | null;
    orderNo: number | null;
    elasticName: string | null;
  };
  lots?: TracedLot[];
  exposure?: {
    delivered: ExposureRow[];
    inTransit: ExposureRow[];
    inHouse: ExposureRow[];
  };
  summary?: {
    lots: number;
    otherJobs: number;
    otherCustomers: number;
    delivered: number;
    inTransit: number;
    inHouse: number;
    uncertain: number;
  };
  caveats?: string[];
}

export interface ThemeRow {
  label: string;
  count: number;
  sharePct: number;
  complaintIds: string[];
  examples: string[];
}

export interface ThemesReport {
  windowDays: number;
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  /**
   * null is meaningful and is NOT an empty list. Below the volume floor
   * the backend refuses to cluster, and `note` says why — "no themes
   * found" and "not enough data to look" are different claims.
   */
  themes: ThemeRow[] | null;
  ungrouped: number | null;
  sampled?: number;
  aiGenerated: boolean;
  belowThreshold?: boolean;
  note?: string;
}
