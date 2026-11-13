export interface Supplier {
  _id: string;
  name: string;
  /** The ledger's name in Tally when it differs from `name`. */
  tallyName?: string;
  gstin?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  isActive?: boolean;
  createdAt?: string;

  // ── Replenishment terms ──
  /** 0 = none recorded; the forecast then uses what deliveries measured. */
  leadTimeDays?: number;
  minOrderQty?: number;
  packSize?: number;

  // ── Accounts ──
  /** What GST it may charge: a composition dealer or unregistered supplier charges none. */
  gstRegistration?: "regular" | "composition" | "unregistered";
  /** Days after the bill date its bills fall due. */
  paymentTermsDays?: number;
  /** MSME (Udyam) status: a micro or small enterprise must be paid within 15 days, or the days agreed (≤45). */
  msme?: { category?: "" | "micro" | "small" | "medium"; udyam?: string; agreedDays?: number };
  /** For the TDS return (26Q); without one, 20% applies (s.206AA). */
  pan?: string;
  /** Where they are paid; a change in the last 30 days stops a payment until confirmed. */
  bank?: { accountNo?: string; ifsc?: string; holder?: string; changedAt?: string | null; changedByName?: string; previousAccountNo?: string };
}

export interface SupplierFormValues {
  /** The ledger's name in Tally when it differs from `name`. */
  tallyName?: string;
  /** Set when the form was filled from a card: the AI ledger row the save settles. */
  aiSuggestion?: string;
  gstRegistration?: "regular" | "composition" | "unregistered";
  paymentTermsDays?: number;
  msme?: { category?: "" | "micro" | "small" | "medium"; udyam?: string; agreedDays?: number };
  /** For the TDS return (26Q); without one, 20% applies (s.206AA). */
  pan?: string;
  bank?: { accountNo?: string; ifsc?: string; holder?: string; source?: "" | "typed" | "cheque"; holderMatches?: boolean | null };
  name: string;
  phoneNumber?: string;
  gstin?: string;
  email?: string;
  address?: string;
  contactPerson?: string;

  // ── Replenishment terms ──
  /**
   * How long this supplier takes to deliver, in days. THE number the
   * reorder point is built on. Leave it blank and the system falls back
   * to whatever your goods receipts have measured — set it only when you
   * know something the history does not.
   */
  leadTimeDays?: number;
  /** What they will sell in one go. */
  minOrderQty?: number;
  /** Their pack size, so an order of 812 kg becomes 825 rather than a phone call. */
  packSize?: number;
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
  /** What this PO was raised for — kept so the purchase stays answerable. */
  forOrder?: string;
  forJob?: string;
  supplier: string;
  items: PoFormItem[];
  expectedDate?: string;
  notes?: string;
}

// ── What a supplier quoted (their price list or quotation) ──
/** The live rate for one material from one supplier; a newer list or quotation replaces it. */
export interface SupplierRate {
  _id: string; supplier: string; supplierName: string; rawMaterial: string; materialName: string;
  /** As the supplier wrote it. */
  description: string;
  rate: number; unit: string; gstPercent: number | null; minQty: number | null;
  source: "price_list" | "quotation" | "manual"; ref: string; quotedOn: string | null; validUntil: string | null; createdAt?: string;
}
/** One line of a price list read: put against one of our materials (or not), with the rate live for it now. */
export interface PriceListRow {
  description: string; rate: number; unit: string; gstPercent: number | null; minQty: number | null;
  rawMaterial: string | null; materialName: string | null;
  candidates: Array<{ id: string; name: string; score: number }>;
  current: { rate: number; unit: string; ref: string; quotedOn: string | null } | null;
  /** Against the live rate, in per cent. */
  change: number | null;
}
export interface PriceListResult {
  read: {
    problem: null | "not_a_price_list" | "unreadable";
    kind?: "price_list" | "quotation"; supplierName?: string; supplierGstin?: string; ref?: string; date?: string | null; validUntil?: string | null;
  };
  supplier: { _id: string; name: string; matchedBy: "picked" | "gstin" | "name" } | null;
  rows: PriceListRow[];
  aiSuggestion: string | null;
}
/** A purchase order line above what the supplier quoted. `line` is its place in the lines sent. */
export interface RateFlag { code: "ABOVE_QUOTE"; severity: "warning"; message: string; line: number }
