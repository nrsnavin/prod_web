export type SampleStatus = "open" | "in_progress" | "completed" | "closed";

export type SampleLogKind =
  | "created"
  | "update"
  | "status"
  | "photo"
  | "photo_removed";

export interface SampleLogEntry {
  _id: string;
  kind: SampleLogKind;
  note: string;
  /** Set on a status entry — what the sample was moved to, and from. */
  status: SampleStatus | null;
  fromStatus: SampleStatus | null;
  /** Set on a photo entry — the SamplePhoto it is about. */
  photo: string | null;
  byName: string;
  at: string;
}

export interface SamplePhoto {
  _id: string;
  caption: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedByName: string;
  createdAt: string;
  /** A removed photo keeps its row: the log said it was here. */
  removed: boolean;
  removedAt: string | null;
  removalReason: string;
}

export interface SampleRow {
  _id: string;
  sampleNo: number;
  title: string;
  customer: { _id: string; name: string } | string | null;
  customerName: string;
  details: string;
  quantity: number;
  targetDate: string | null;
  priority: "low" | "normal" | "high";
  status: SampleStatus;
  raisedByName: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  logCount: number;
  photoCount: number;
  lastEntry: {
    kind: SampleLogKind;
    note: string;
    status: SampleStatus | null;
    byName: string;
    at: string;
  } | null;
}

export interface SampleDetail extends SampleRow {
  log: SampleLogEntry[];
  photos: SamplePhoto[];
}

export interface SampleListResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  counts: Record<SampleStatus, number>;
  samples: SampleRow[];
}

export interface SampleCreateValues {
  title: string;
  details: string;
  customerId?: string;
  customerName?: string;
  quantity?: number;
  targetDate?: string;
  priority?: "low" | "normal" | "high";
  note?: string;
}
