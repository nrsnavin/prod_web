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
  /** Server-computed: opening + receipts − payments. */
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
  supplyType: SupplyType;
  lines?: TaxLine[];
  totals: InvoiceTotals;
  status: "issued" | "cancelled";
  cancel?: { reason?: string; at?: string };
  notes?: string;
  fingerprints?: Fingerprint[];
}

export interface NoteCreateBody {
  kind: NoteKind;
  against: { doc: string };
  reason: string;
  date?: string;
  lines: LineInput[];
  notes?: string;
  requestId?: string;
}

export type VoucherKind = "receipt" | "payment";
export type PaymentMode = "cash" | "bank" | "upi" | "cheque";
export interface Allocation {
  docType: "Invoice" | "SupplierBill" | "Expense";
  doc: string;
  docNo: string;
  amount: number;
  tds: number;
}
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
  tds: { section?: string; rate?: number; amount: number };
  allocations: Allocation[];
  unallocated: number;
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
  allocations: Array<{ docType: Allocation["docType"]; doc: string; amount: number }>;
  narration?: string;
  source?: string;
  statementLine?: string;
  requestId?: string;
}

export type AgeingBucket = "current" | "d30" | "d60" | "d90" | "over90";
export interface OpenDoc {
  docType: "Invoice" | "SupplierBill" | "Expense";
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
  docType: "Invoice" | "SupplierBill" | "Expense" | "AccountNote" | "Payment";
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
  rows: Array<{ supplier?: string; partyName: string; section: string; rate: number; gross: number; tds: number; vouchers: Array<{ _id: string; voucherNo: string; date: string; gross: number; tds: number; docs: string[] }> }>;
  total: { gross: number; tds: number };
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
  rows: Array<Payment & { inflow: number; outflow: number; balance: number }>;
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
