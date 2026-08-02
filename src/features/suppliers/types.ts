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
  /**
   * How much has actually arrived. The document field is
   * `receivedQuantity`; the detail route also emits it under this name,
   * which is the one every screen here reads. Both are declared so a
   * response from either shape is usable.
   */
  received?: number;
  receivedQuantity?: number;
  /**
   * Still to come, stated by the server rather than subtracted here.
   * Two screens doing the same subtraction under two different field
   * names is exactly how the pending column came to print the full
   * order quantity forever.
   */
  pending?: number;
}

/** What has arrived on a line, whichever name the server used. */
export const poItemReceived = (it: PoItem): number =>
  Number(it.received ?? it.receivedQuantity ?? 0) || 0;

/** What is still to come. Never negative — over-delivery is allowed. */
export const poItemPending = (it: PoItem): number =>
  it.pending != null
    ? Number(it.pending) || 0
    : Math.max(0, (Number(it.quantity) || 0) - poItemReceived(it));

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
