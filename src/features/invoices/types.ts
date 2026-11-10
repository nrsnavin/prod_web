// Mirrors models/Invoice.js and api/invoice.js on the backend.

export type InvoiceStatus = "issued" | "cancelled";
export type EinvoiceStatus = "pending" | "registered" | "cancelled";
export type SupplyType = "intra" | "inter" | "export" | "sez";
export type ExportKind = "EXPWP" | "EXPWOP" | "SEZWP" | "SEZWOP" | "DEXP";
/** An export, SEZ or deemed-export supply: the kind, the LUT, the currency, port and shipping bill. */
export interface InvoiceExport { kind: ExportKind | ""; currency?: string; exchangeRate?: number; countryCode?: string; portCode?: string; shippingBill?: { number?: string; date?: string }; lut?: { number?: string; validFrom?: string; validTo?: string } }
export interface ExportBody { kind: ExportKind; currency?: string; exchangeRate?: number | ""; countryCode?: string; portCode?: string; shippingBill?: { number?: string; date?: string } }

export interface InvoiceParty {
  name: string;
  address: string;
  city: string;
  pincode: string;
  /** Two-digit GST state code. */
  stateCode: string;
  gstin: string;
  phone?: string;
  email?: string;
}

export interface InvoiceLine {
  elastic?: string;
  name: string;
  hsn: string;
  unit: string;
  quantity: number;
  /** Cartons the line went out in. */
  boxes?: number;
  rate: number;
  taxable: number;
  gstPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
  /** The challans this line's quantity came off. */
  dcNumbers?: string[];
}

export interface InvoiceTotals {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  grand: number;
}

export interface InvoiceEinvoice {
  status: EinvoiceStatus;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  signedQr?: string;
  /** Which provider registered it, or "manual" when pasted in. */
  provider?: string;
  registeredAt?: string;
  cancelledAt?: string;
}

/** The e-way bill for the goods' movement (CGST Rule 138). */
export interface Ewaybill {
  status: "" | "generated" | "cancelled";
  number?: string; generatedAt?: string; validUpto?: string; vehicleNo?: string; transporterId?: string; transporterName?: string; transDocNo?: string; distanceKm?: number; mode?: "road" | "rail" | "air" | "ship"; provider?: string;
}
export interface EwaybillBody { vehicleNo?: string; transporterId?: string; transporterName?: string; transDocNo?: string; distanceKm?: number; mode?: Ewaybill["mode"]; number?: string; validUpto?: string }

export interface InvoiceFingerprint {
  code: string;
  label: string;
  at: string;
  actor?: { name?: string };
  meta?: Record<string, unknown>;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  order: string;
  orderNo?: number;
  customer: string | { _id: string; name: string };
  customerPo?: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  /** Where the goods went — the challans' consignee address. */
  shipTo?: string;
  totalBoxes?: number;
  supplyType: SupplyType;
  placeOfSupply: string;
  export?: InvoiceExport;
  dcs: Array<{ dc: string; dcNumber: string; dispatchDate?: string }>;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  amountInWords: string;
  notes?: string;
  status: InvoiceStatus;
  cancel?: { reason?: string; at?: string };
  einvoice: InvoiceEinvoice;
  ewaybill?: Ewaybill;
  /** What the e-invoice portal would refuse; empty when it can be registered. */
  einvoiceProblems?: string[];
  fingerprints?: InvoiceFingerprint[];
  createdAt?: string;
  /** Money against it so far, as the receivables reckon it. */
  dueDate?: string | null;
  paidAmount?: number;
  creditedAmount?: number;
  debitedAmount?: number;
}

/** A list row or a card row: the invoice without its lines' tax detail. */
export type InvoiceSummary = Pick<
  Invoice,
  "_id" | "invoiceNumber" | "invoiceDate" | "orderNo" | "status" | "totals" | "supplyType" | "dcs" | "createdAt"
> & {
  order?: string;
  /** For "paid / part paid / overdue": the same reckoning as the receivables. */
  dueDate?: string | null;
  paidAmount?: number;
  creditedAmount?: number;
  debitedAmount?: number;
  buyer?: Partial<InvoiceParty>;
  einvoice?: Partial<InvoiceEinvoice>;
  lines?: Array<Pick<InvoiceLine, "name" | "quantity" | "unit">>;
};

export interface InvoiceDcOption {
  _id: string;
  dcNumber: string;
  status: string;
  dispatchDate?: string;
  totalQuantity: number;
  /** The invoice this challan is already on, if any. */
  invoicedOn: string | null;
  eligible: boolean;
  items: Array<{ elastic?: string; elasticName?: string; quantity: number; unit?: string }>;
}

export interface InvoiceDraftLine {
  elastic: string;
  name: string;
  unit: string;
  quantity: number;
  boxes?: number;
  rate: number;
  hsn: string;
  gstPercent: number;
  dcNumbers: string[];
  rateSource: "order" | "challan" | "entered" | "none";
}

export interface InvoiceOrderInfo {
  order: { _id: string; orderNo: number; po?: string; status?: string; customer?: string };
  seller: InvoiceParty;
  buyer: InvoiceParty;
  /** Proposed ship-to: the challans' consignee address, else the buyer's. */
  shipTo: string;
  supplyType: SupplyType;
  placeOfSupply: string;
  dcs: InvoiceDcOption[];
  lines: InvoiceDraftLine[];
  defaults: { hsn: string; gstPercent: number };
  problems: string[];
  /** Export / SEZ: what the customer file suggests, the kinds, and the LUT on file. */
  export?: { suggested: ExportKind | ""; kinds: Array<{ kind: ExportKind; label: string; zeroRated: boolean; needsLut: boolean }>; lut: { number: string; validFrom: string | null; validTo: string | null }; currency: string; country: string; sez: boolean };
}

export interface InvoiceLineOverride {
  elastic: string;
  rate?: number | "";
  hsn?: string;
  gstPercent?: number | "";
  boxes?: number | "";
}

export interface InvoiceCreateBody {
  /** An admin releasing a customer on credit hold, with the reason. */
  creditOverride?: string;
  orderId: string;
  dcIds: string[];
  invoiceDate?: string;
  notes?: string;
  shipTo?: string;
  lines?: InvoiceLineOverride[];
  requestId?: string;
  /** An export, SEZ or deemed-export supply. */
  export?: ExportBody;
}

export interface OrderInvoices {
  invoices: InvoiceSummary[];
  totals: { count: number; cancelled: number; invoiced: number; registered: number };
  /** Challans that have left and are not on an invoice yet. */
  uninvoicedDcs: Array<{ _id: string; dcNumber: string; totalQuantity: number }>;
}

export interface CustomerInvoices {
  invoices: InvoiceSummary[];
  total: number;
  invoiced: { amount: number; count: number };
}

export interface IrnPasteBody {
  irn: string;
  ackNo?: string;
  ackDate?: string;
  signedQr?: string;
}
