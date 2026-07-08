export interface PackingGroupedRow {
  job: {
    _id?: string;
    jobOrderNo: number;
    status?: string;
    customer?: { name?: string } | null;
  };
  totalBoxes: number;
  totalMeters: number;
}

export interface PackingRecord {
  _id: string;
  job?: { _id: string; jobOrderNo: number } | string | null;
  elastic?: { _id: string; name: string } | string | null;
  meter: number;
  netWeight?: number;
  tareWeight?: number;
  grossWeight?: number;
  joints?: number;
  stretch?: string;
  size?: string;
  batch?: string;
  checkedBy?: { _id: string; name: string } | string | null;
  packedBy?: { _id: string; name: string } | string | null;
  createdAt?: string;
}

export interface PackingJob {
  _id: string;
  jobOrderNo: number;
  customer?: { name?: string } | null;
  elastics?: Array<{ elastic: { _id: string; name: string } | string | null; quantity: number }>;
}

export interface PackingFormValues {
  job: string;
  elastic: string;
  meter: number;
  netWeight: number;
  tareWeight: number;
  grossWeight: number;
  checkedBy: string;
  packedBy: string;
  joints?: number;
  stretch?: string;
  size?: string;
}
