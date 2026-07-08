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
