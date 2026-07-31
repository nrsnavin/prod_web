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
  rawMaterial: { _id: string; name: string; category?: string; unit?: string } | string;
  price: number;
  quantity: number;
  received?: number;
}

export interface PoSupplierRef {
  _id: string;
  name: string;
  gstin?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
}

export interface PurchaseOrder {
  _id: string;
  poNo: number | string;
  supplier: PoSupplierRef | string;
  items: PoItem[];
  status: PoStatus;
  expectedDate?: string;
  notes?: string;
  date?: string;
  createdAt?: string;
}

export interface InwardRecord {
  _id: string;
  rawMaterial?: { _id: string; name: string } | string;
  quantity: number;
  inwardDate?: string;
  createdAt?: string;
  remarks?: string;
  /** How much this receipt put the line over its ordered quantity. */
  excessQuantity?: number;
  /** Why, when the excess went past the free tolerance. */
  excessReason?: string;
  lotNo?: string;
}

export interface PoFormItem {
  rawMaterial: string;
  price: number;
  quantity: number;
}

export interface PoFormValues {
  supplier: string;
  items: PoFormItem[];
  expectedDate?: string;
  notes?: string;
}
