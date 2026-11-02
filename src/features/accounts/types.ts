// Mirrors api/accounts.js and the accounts models on the backend.

import type { InvoiceTotals, SupplyType } from "@/features/invoices/types";

export type AccountKind = "bank" | "cash" | "upi";
export interface BankAccount {
  _id: string;
  name: string;
  kind: AccountKind;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  upiId?: string;
  openingBalance?: number;
  openingDate?: string | null;
  float?: number;
  active?: boolean;
  isDefault?: boolean;
  /** The ledger this account is in Tally. */
  tallyLedger?: string;
  /** Server-computed: opening + money in − money out (contras both ways). */
  balance?: number;
  receipts?: number;
  payments?: number;
}

export interface ExpenseCategory {
  _id: string;
  name: string;
  ledger?: string;
  itcEligible?: boolean;
  /** Expenses above this need an approver; 0 = always. */
  approvalAbove?: number;
  tdsSection?: string;
  active?: boolean;
}

export interface TaxLine {
  rawMaterial?: string;
  description: string;
  hsn?: string;
  unit?: string;
  quantity: number;
  rate: number;
  taxable: number;
  gstPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

/** What the forms send: the server prices it. */
export interface LineInput {
  rawMaterial?: string;
  description: string;
  hsn?: string;
  unit?: string;
  quantity: number | "";
  rate: number | "";
  gstPercent: number | "";
}

export interface Attachment {
  _id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt?: string;
}

export interface Fingerprint {
  code: string;
  label: string;
  at: string;
  actor?: { name?: string };
  meta?: Record<string, unknown>;
}

export type BillStatus = "open" | "part_paid" | "paid" | "cancelled";
export interface SupplierBill {
  _id: string;
  billNo: string;
  supplier: string;
  supplierName: string;
  supplierGstin?: string;
  supplierBillNo: string;
  billDate: string;
  dueDate?: string;
  purchaseOrder?: string;
  poNo?: number;
  inwards?: string[];
  kind: "goods" | "service";
  category?: string | { _id: string; name: string };
  supplyType: SupplyType;
  lines?: TaxLine[];
  totals: InvoiceTotals;
  itc: { eligible: boolean; amount: number };
  tds: { applicable: boolean; section?: string; rate?: number };
  paidAmount: number;
  tdsAmount: number;
  debitedAmount: number;
  outstanding?: number;
  status: BillStatus;
  cancel?: { reason?: string; at?: string };
  notes?: string;
  attachments?: Attachment[];
  source?: string;
  fingerprints?: Fingerprint[];
  createdAt?: string;
}

export interface BillPoInfo {
  po: { _id: string; poNo: number; date?: string; status: string; supplier: { _id: string; name: string; gstin?: string } };
  inwards: Array<{ _id: string; date: string; material: string; quantity: number; unit: string; lotNo?: string; unitPrice: number; billedOn: string | null }>;
  bills: Array<{ _id: string; billNo: string; supplierBillNo: string; grand: number }>;
  lines: Array<LineInput & { inwards: string[] }>;
}

export interface BillCreateBody {
  supplier: string;
  supplierBillNo: string;
  billDate?: string;
  dueDate?: string;
  purchaseOrder?: string;
  inwards?: string[];
  kind?: "goods" | "service";
  category?: string;
  lines: LineInput[];
  itcEligible?: boolean;
  tds?: { applicable: boolean; section?: string; rate?: number };
  notes?: string;
  source?: string;
  aiSuggestion?: string;
  requestId?: string;
}

export type ExpenseStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";
export interface Expense {
  _id: string;
  expenseNo: string;
  date: string;
  dueDate?: string;
  category: string;
  categoryName: string;
  description: string;
  supplier?: string;
  payeeName?: string;
  payeeGstin?: string;
  refNo?: string;
  supplyType: SupplyType;
  lines?: TaxLine[];
  totals: InvoiceTotals;
  itc: { eligible: boolean; amount: number };
  status: ExpenseStatus;
  approval?: { required: boolean; byName?: string; at?: string; note?: string };
  paidAmount: number;
  paidFrom?: string | { _id: string; name: string; kind: AccountKind };
  paidAt?: string;
  submittedByName?: string;
  notes?: string;
  attachments?: Attachment[];
  source?: string;
  fingerprints?: Fingerprint[];
}

export interface ExpenseCreateBody {
  date?: string;
  category: string;
  description: string;
  supplier?: string;
  payeeName?: string;
  payeeGstin?: string;
  refNo?: string;
  /** A plain amount, or itemised lines. */
  amount?: number;
  gstPercent?: number;
  lines?: LineInput[];
  itcEligible?: boolean;
  payNow?: { account: string; mode?: string; reference?: string };
  notes?: string;
  source?: string;
  aiSuggestion?: string;
  requestId?: string;
}

export type NoteKind = "credit" | "debit";
export interface AccountNote {
  _id: string;
  kind: NoteKind;
  noteNo: string;
  date: string;
  partyType: "customer" | "supplier";
  customer?: string;
  supplier?: string;
  partyName: string;
  partyGstin?: string;
  against: { docType: "Invoice" | "SupplierBill"; doc: string; docNo: string };
  reason: string;
  /** The party's own number for the same note. */
  partyNoteNo?: string;
  supplyType: SupplyType;
  lines?: TaxLine[];
  totals: InvoiceTotals;
  /** Set against `against`; the rest is unapplied credit on the party. */
  applied?: number;
  unapplied?: number;
  applications?: Array<{ docType: Allocation["docType"]; doc: string; docNo: string; amount: number; at?: string }>;
  status: "issued" | "cancelled";
  cancel?: { reason?: string; at?: string };
  notes?: string;
  fingerprints?: Fingerprint[];
}

export interface NoteCreateBody {
  kind: NoteKind;
  /** A debit note goes to a supplier unless this says customer. */
  partyType?: "customer" | "supplier";
  partyNoteNo?: string;
  against: { doc: string };
  reason: string;
  date?: string;
  lines: LineInput[];
  notes?: string;
  requestId?: string;
}

export type VoucherKind = "receipt" | "payment";
export type PaymentMode = "cash" | "bank" | "upi" | "cheque";
export type SettleDocType = "Invoice" | "SupplierBill" | "Expense" | "OpeningBalance";
export interface Allocation {
  docType: SettleDocType;
  doc: string;
  docNo: string;
  amount: number;
  tds: number;
  /** The value TDS was deducted on (net of GST). */
  tdsBase?: number;
  /** Set when an amount left on account was applied later. */
  appliedAt?: string;
}
export type AdjustmentKind = "bank_charges" | "discount" | "tds_by_customer" | "round_off" | "write_off";
export interface Adjustment { kind: AdjustmentKind; label?: string; amount: number; note?: string }
export const ADJUSTMENT_LABELS: Record<AdjustmentKind, string> = {
  bank_charges: "Bank charges", discount: "Discount", tds_by_customer: "TDS deducted by customer", round_off: "Round off", write_off: "Write off",
};
export const ADJUSTMENT_KINDS: Record<"receipt" | "payment", AdjustmentKind[]> = {
  receipt: ["bank_charges", "discount", "tds_by_customer", "round_off", "write_off"],
  payment: ["discount", "round_off", "write_off"],
};
export interface Payment {
  _id: string;
  kind: VoucherKind;
  voucherNo: string;
  date: string;
  partyType: "customer" | "supplier" | "other";
  customer?: string;
  supplier?: string;
  partyName: string;
  amount: number;
  mode: PaymentMode;
  account: string;
  accountName?: string;
  reference?: string;
  tds: { section?: string; rate?: number; amount: number; base?: number };
  adjustments?: Adjustment[];
  allocations: Allocation[];
  unallocated: number;
  clearedOn?: string;
  status: "posted" | "cancelled";
  cancel?: { reason?: string; at?: string };
  narration?: string;
  source?: string;
  fingerprints?: Fingerprint[];
}

export interface PaymentCreateBody {
  kind: VoucherKind;
  date?: string;
  partyType: "customer" | "supplier" | "other";
  customer?: string;
  supplier?: string;
  partyName?: string;
  amount: number;
  mode: PaymentMode;
  account: string;
  reference?: string;
  tds?: { section?: string; rate?: number };
  adjustments?: Array<{ kind: AdjustmentKind; amount: number; note?: string }>;
  allocations: Array<{ docType: Allocation["docType"]; doc: string; amount: number }>;
  narration?: string;
  source?: string;
  statementLine?: string;
  requestId?: string;
}

export type AgeingBucket = "current" | "d30" | "d60" | "d90" | "over90";
export interface OpenDoc {
  docType: SettleDocType;
  id: string;
  docNo: string;
  refNo?: string;
  date: string;
  dueDate: string;
  party: string;
  partyName: string;
  orderNo?: number | null;
  poNo?: number | null;
  description?: string;
  amount: number;
  outstanding: number;
  overdueDays: number;
  bucket: AgeingBucket;
  tds?: { section: string; rate: number } | null;
  /** Value net of GST over the total: the share TDS is deducted on. */
  taxableRatio?: number;
}
export interface Ageing { current: number; d30: number; d60: number; d90: number; over90: number }
export interface OutstandingTotals { total: number; overdue: number; count: number; ageing: Ageing }
export interface PartyOutstanding extends OutstandingTotals { party: string; partyName: string; oldestDays: number; docs: OpenDoc[] }
export interface OutstandingResult {
  type: "receivable" | "payable";
  rows: OpenDoc[];
  byParty: PartyOutstanding[];
  totals: OutstandingTotals;
  buckets: Array<{ key: AgeingBucket; label: string }>;
}

export interface LedgerRow {
  _id: string;
  date: string;
  docType: "Invoice" | "SupplierBill" | "Expense" | "AccountNote" | "Payment" | "OpeningBalance";
  doc: string;
  docNo: string;
  debit: number;
  credit: number;
  narration?: string;
  balance: number;
}
export interface Statement {
  party: { _id: string; name: string; gstin?: string };
  partyType: "customer" | "supplier";
  opening: number;
  rows: LedgerRow[];
  closing: number;
  open: OutstandingTotals;
}

export interface Overview {
  receivables: OutstandingTotals & { top: PartyOutstanding[] };
  payables: OutstandingTotals & { top: PartyOutstanding[] };
  accounts: Array<{ _id: string; name: string; kind: AccountKind; balance: number }>;
  pendingExpenses: number;
  month: {
    from: string;
    expenses: { amount: number; count: number };
    sales: { amount: number; outputTax: number; count: number };
    purchases: { amount: number; inputCredit: number; count: number };
  };
  recentPayments: Array<Pick<Payment, "_id" | "kind" | "voucherNo" | "date" | "partyName" | "amount" | "mode" | "accountName">>;
}

export interface GstRateRow { rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }
export interface GstReport {
  from: string;
  to: string;
  output: { sales: GstRateRow[]; creditNotes: GstRateRow[] };
  input: { purchases: GstRateRow[]; debitNotes: GstRateRow[]; expenses: GstRateRow[] };
  totals: {
    output: GstRateRow; creditNotes: GstRateRow; purchases: GstRateRow; debitNotes: GstRateRow; expenses: GstRateRow;
    netOutput: { cgst: number; sgst: number; igst: number };
    netInput: { cgst: number; sgst: number; igst: number };
    payable: { cgst: number; sgst: number; igst: number };
  };
  counts: { invoices: number; creditNotes: number; bills: number; debitNotes: number; expenses: number };
}
export interface TdsReport {
  from: string;
  to: string;
  rows: Array<{ supplier?: string; partyName: string; section: string; rate: number; gross: number; base?: number; tds: number; vouchers: Array<{ _id: string; voucherNo: string; date: string; gross: number; base?: number; tds: number; docs: string[] }> }>;
  total: { gross: number; base?: number; tds: number };
}
export interface ExpenseReport {
  from: string;
  to: string;
  rows: Array<{ category: string; categoryName: string; amount: number; taxable: number; itc: number; count: number; unpaid: number }>;
  serviceBills: Array<{ category: string | null; categoryName: string; amount: number; count: number }>;
  total: number;
}
export interface CashbookReport {
  account: { _id: string; name: string; kind: AccountKind };
  from: string;
  to: string;
  opening: number;
  rows: Array<Omit<Payment, "kind"> & { kind: VoucherKind | "contra"; docType?: "Payment" | "Contra"; inflow: number; outflow: number; balance: number }>;
  closing: number;
  inflow: number;
  outflow: number;
}
export interface DaybookReport {
  date: string;
  invoices: Array<{ _id: string; invoiceNumber: string; buyer?: { name?: string }; totals?: { grand?: number }; orderNo?: number }>;
  bills: Array<{ _id: string; billNo: string; supplierName: string; supplierBillNo: string; totals?: { grand?: number } }>;
  expenses: Array<{ _id: string; expenseNo: string; categoryName: string; description: string; payeeName?: string; totals?: { grand?: number }; status: ExpenseStatus }>;
  notes: Array<{ _id: string; kind: NoteKind; noteNo: string; partyName: string; totals?: { grand?: number }; against?: { docNo?: string }; reason: string }>;
  payments: Array<{ _id: string; kind: VoucherKind; voucherNo: string; partyName: string; amount: number; mode: PaymentMode; accountName?: string; tds?: { amount?: number }; allocations?: Array<{ docNo: string }> }>;
  totals: { sales: number; purchases: number; expenses: number; received: number; paid: number };
}

// ── AI ──
export interface ScanLine { description: string; hsn: string; quantity: number; unit: string; rate: number | null; gstPercent: number | null; amount: number | null; confidence: number }
export interface ScanRead {
  kind: "bill" | "receipt" | null;
  problem: null | "not_a_bill" | "unreadable";
  supplierName: string;
  supplierGstin: string;
  billNo: string;
  billDate: string | null;
  dueDate: string | null;
  lines: ScanLine[];
  totals: { taxable: number | null; cgst: number | null; sgst: number | null; igst: number | null; grand: number | null };
  confidence: number;
}
export interface ScanResult {
  read: ScanRead;
  supplier: { _id: string; name: string; gstin?: string; matchedBy: "gstin" | "name" } | null;
  alreadyEntered: string | null;
  purchaseOrders: Array<{ _id: string; poNo: number; date?: string; status: string; receipts: number; unbilledReceipts: number }>;
  aiSuggestion: string | null;
}

export interface StatementSuggestion {
  partyType: "customer" | "supplier";
  party: string;
  partyName: string;
  allocations: Array<{ docType: Allocation["docType"]; doc: string; docNo: string; amount: number }>;
  confidence: number;
  reason: string;
  byModel?: boolean;
}
export interface StatementRow {
  index: number;
  date: string;
  narration: string;
  ref: string;
  amount: number;
  direction: "in" | "out";
  status: "recorded" | "matched" | "unmatched";
  suggestion: StatementSuggestion | null;
  recorded?: { _id: string; voucherNo: string; partyName: string };
  candidates?: Array<{ partyType: "customer" | "supplier"; party: string; partyName: string; docNo: string; docType: Allocation["docType"]; doc: string }>;
}
export interface StatementResult { account: { _id: string; name: string }; rows: StatementRow[]; counts: { recorded: number; matched: number; unmatched: number }; file: string }
export interface StatementPostRow {
  date: string; narration: string; ref: string; amount: number; direction: "in" | "out";
  partyType: "customer" | "supplier" | "other"; party?: string; partyName?: string;
  allocations?: Array<{ docType: Allocation["docType"]; doc: string; amount: number }>;
  requestId?: string;
}

export interface CollectionEntry {
  party: string; partyName: string; total: number; overdue: number; oldestDays: number; count: number; priority: number;
  docs: OpenDoc[];
  contact: { name: string; phone: string; email: string; accountant: string; accountantPhone: string; paymentTerms: string };
}

// ── Credits, contras, opening balances, settings ──
export interface Credit {
  sourceType: "Payment" | "AccountNote" | "OpeningBalance";
  id: string;
  docNo: string;
  date: string;
  amount: number;
  available: number;
  label: string;
}

export interface Contra {
  _id: string;
  contraNo: string;
  date: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
  mode: PaymentMode;
  reference?: string;
  narration?: string;
  status: "posted" | "cancelled";
  cancel?: { reason?: string };
}

export interface OpeningBalance {
  _id: string;
  docNo: string;
  partyType: "customer" | "supplier";
  customer?: string;
  supplier?: string;
  partyName: string;
  kind: "due" | "advance";
  refNo?: string;
  date: string;
  dueDate?: string;
  amount: number;
  settledAmount: number;
  unapplied: number;
  status: "posted" | "cancelled";
  notes?: string;
}
export interface OpeningImportRow {
  line: number;
  partyType: "customer" | "supplier" | null;
  party: string | null;
  partyName: string;
  refNo: string;
  date: string | null;
  dueDate: string | null;
  amount: number;
  kind: "due" | "advance" | null;
  problem: string | null;
}

export type TallyLedgerKey =
  | "companyName" | "sales" | "purchase" | "outputCgst" | "outputSgst" | "outputIgst" | "inputCgst" | "inputSgst" | "inputIgst"
  | "roundOff" | "tdsPayable" | "tdsReceivable" | "bankCharges" | "discountAllowed" | "discountReceived" | "badDebts" | "sundryExpenses"
  | "debtorsGroup" | "creditorsGroup";
export interface AccountsSettings {
  lockDate: string | null;
  lockedBy?: string;
  lockedAt?: string;
  tally: Record<TallyLedgerKey, string>;
  bills: { rateVariancePercent: number };
}
