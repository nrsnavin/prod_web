export interface Supplier {
  _id: string;
  name: string;
  gstin?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface SupplierFormValues {
  name: string;
  phoneNumber?: string;
  gstin?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
}

export type PoStatus = "Open" | "Partial" | "Completed";

export interface PoItem {
  _id?: string;
  rawMaterial: { _id: string; name: string; category?: string } | string;
  price: number;
  quantity: number;
  received?: number;
}

export interface PurchaseOrder {
  _id: string;
  poNo: number | string;
  supplier: { _id: string; name: string } | string;
  items: PoItem[];
  status: PoStatus;
  createdAt?: string;
}

export interface InwardRecord {
  _id: string;
  rawMaterial?: { _id: string; name: string } | string;
  quantity: number;
  inwardDate?: string;
  createdAt?: string;
  remarks?: string;
}

export interface PoFormItem {
  rawMaterial: string;
  price: number;
  quantity: number;
}

export interface PoFormValues {
  supplier: string;
  items: PoFormItem[];
}
