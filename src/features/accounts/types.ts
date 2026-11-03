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
  /** Most one person may claim under this head in a day; 0 = no limit. */
  claimDailyLimit?: number;
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
  reverseCharge?: boolean;
  rcm?: { cgst: number; sgst: number; igst: number; tax: number };
  variance?: BillVariance;
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

export interface BillVariance {
  lines: Array<{ description: string; poRate: number | null; billRate: number; receivedQty: number | null; billedQty: number; rateOffPercent: number | null; amount: number }>;
  total: number;
  note?: string;
}

export interface BillCreateBody {
  reverseCharge?: boolean;
  /** Why a bill off the PO or the receipts is right (the three-way match). */
  varianceNote?: string;
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
  einvoice?: { status: "pending" | "registered" | "cancelled"; irn?: string; ackNo?: string; ackDate?: string };
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

/** A party's open documents, with what it paid (or was paid) ahead beside them. */
export type PartyWithAhead = PartyOutstanding & { paidAhead?: number };
export interface Overview {
  receivables: OutstandingTotals & { paidAhead?: number; top: PartyWithAhead[] };
  payables: OutstandingTotals & { paidAhead?: number; top: PartyWithAhead[] };
  accounts: Array<{ _id: string; name: string; kind: AccountKind; balance: number }>;
  pendingExpenses: number;
  month: {
    from: string;
    to?: string;
    /** False in the first days of a month, when the figures are last month's. */
    current?: boolean;
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
  status: "recorded" | "matched" | "unmatched" | "ignored";
  suggestion: StatementSuggestion | null;
  recorded?: { _id: string; voucherType?: "Payment" | "Contra"; voucherNo: string; partyName: string };
  note?: string;
  balance?: number | null;
  candidates?: Array<{ partyType: "customer" | "supplier"; party: string; partyName: string; docNo: string; docType: Allocation["docType"]; doc: string }>;
}
export interface StatementResult { statement?: string; account: { _id: string; name: string }; rows: StatementRow[]; counts: { recorded: number; matched: number; unmatched: number; ignored?: number }; file: string; closingBalance?: number | null }
export interface StatementPostRow {
  /** The line's index on the stored statement. */
  index?: number;
  date: string; narration: string; ref: string; amount: number; direction: "in" | "out";
  partyType: "customer" | "supplier" | "other"; party?: string; partyName?: string;
  allocations?: Array<{ docType: Allocation["docType"]; doc: string; amount: number }>;
  requestId?: string;
}

export interface CollectionEntry {
  party: string; partyName: string; total: number; overdue: number; oldestDays: number; count: number; priority: number;
  docs: OpenDoc[];
  contact: { name: string; phone: string; email: string; accountant: string; accountantPhone: string; paymentTerms: string };
  lastContact?: { kind: string; at: string; byName?: string; note?: string; channel?: string } | null;
  promise?: { date: string; amount: number; note?: string; live: boolean; broken: boolean } | null;
  recentlyContacted?: boolean;
  held?: boolean;
  /** escalate: over 90 days — the owner calls and new orders are held. */
  next?: { action: "remind" | "call" | "escalate"; tone: "gentle" | "firm"; label: string };
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
  | "rcmCgst" | "rcmSgst" | "rcmIgst"
  | "roundOff" | "tdsPayable" | "tdsReceivable" | "bankCharges" | "discountAllowed" | "discountReceived" | "badDebts" | "writtenBack" | "sundryExpenses"
  | "debtorsGroup" | "creditorsGroup";
export interface AccountsSettings {
  lockDate: string | null;
  lockedBy?: string;
  lockedAt?: string;
  tally: Record<TallyLedgerKey, string>;
  bills: { rateVariancePercent: number };
}

// ── Bank reconciliation ──
export interface StoredStatement {
  _id: string; account: string; accountName: string; file: string; from: string; to: string; closingBalance: number | null;
  uploadedByName?: string; createdAt: string; lines: number; counts: Partial<Record<StatementRow["status"] | "posted", number>>;
}
export interface StoredStatementLine {
  index: number; date: string; narration: string; ref: string; amount: number; direction: "in" | "out"; balance: number | null;
  status: "recorded" | "posted" | "unmatched" | "matched" | "ignored"; voucherType: "Payment" | "Contra" | null; voucher: string | null; voucherNo: string; note: string;
}
export interface BookEntry { voucherType: "Payment" | "Contra"; _id: string; number: string; date: string; party: string; reference: string; direction: "in" | "out"; amount: number }
export interface Reconciliation {
  account: { _id: string; name: string };
  asOf: string;
  bookBalance: number;
  uncleared: BookEntry[];
  unmatched: Array<{ statement: string; index: number; date: string; narration: string; ref: string; amount: number; direction: "in" | "out" }>;
  totals: { unclearedIn: number; unclearedOut: number; unmatchedIn: number; unmatchedOut: number };
  expectedBankBalance: number;
  bankBalance: number | null;
  bankBalanceFrom: "entered" | { statement: string; file: string; to: string } | null;
  difference: number | null;
}

// ── Tally ──
export interface TallyPreview {
  from: string; to: string;
  counts: Record<string, number>;
  vouchers: number;
  alreadySent: number;
  ledgers: string[];
  problems: string[];
  /** Will go, but probably not as meant: a service bill with no head. */
  warnings?: string[];
  sample: Array<{ type: string; number: string; date: string; party: string; lines: Array<{ ledger: string; debit: number; credit: number }> }>;
}
export interface TallyDelivery {
  via: "file" | "connector";
  /** file: downloaded; connector: queued → sending → sent | partial | failed */
  status: "file" | "queued" | "sending" | "sent" | "partial" | "failed";
  sent?: number; failed?: number; attempts?: number; finishedAt?: string;
  errors?: Array<{ key: string; number: string; error: string }>;
}
export interface TallyBatch { _id: string; batchNo: number; from: string; to: string; counts: Record<string, number>; vouchers: number; cancels?: number; ledgers: string[]; lockedUpTo: string | null; byName: string; createdAt: string; delivery?: TallyDelivery }
export interface TallyConnectorStatus { configured: boolean; keyHint?: string; createdAt?: string; lastSeenAt?: string | null; online: boolean; tallyOk?: boolean; version?: string }
export interface TallyReconcile {
  snapshot: null | { at: string; company: string; count: number };
  parties: Array<{ partyType: "customer" | "supplier"; party: string; name: string; tallyName: string; inTally: boolean; app: number; appSent: number; tally: number | null; difference: number | null; unsent: number }>;
  banks: Array<{ account: string; name: string; tallyName: string; inTally: boolean; app: number; tally: number | null; difference: number | null; unsent: number }>;
  missing: Array<{ ledger: string; near: string[] }>;
  onlyInTally: Array<{ name: string; parent: string; closing: number }>;
}
export interface HealthCheck { key: string; label: string; severity: "critical" | "warning"; explain: string; fix: "repair" | "rebuild" | null; ok: boolean; count: number; rows: Array<Record<string, unknown>>; error?: string | null }
export interface BooksHealth { ranAt: string; checks: HealthCheck[] }

// ── Inbox and insights ──
export interface Flag { code: string; severity: "danger" | "warning" | "info"; message: string }
export interface Inbox {
  billsDue: { count: number; overdue?: number; amount: number; top: OpenDoc[] };
  approvals: { count: number; amount: number; top: Array<{ _id: string; expenseNo: string; date: string; categoryName: string; description: string; totals: { grand: number }; submittedByName?: string; source?: string }> };
  claimsToPay: { count: number; amount: number; top: Array<{ _id: string; expenseNo: string; description: string; payeeName?: string; totals: { grand: number }; paidAmount?: number }> };
  bankLines: { count: number; amount?: number; statement?: string; account?: string; accountName?: string };
  toChase: { count: number; amount: number; top: Array<{ party: string; partyName: string; overdue: number; oldestDays: number; next?: CollectionEntry["next"] }> };
  promisesDue: { count: number; top: Array<{ party: string; partyName: string; promise: NonNullable<CollectionEntry["promise"]> }> };
  variances: { count: number; top: Array<{ _id: string; billNo: string; supplierName: string; billDate: string; variance: { total: number; note?: string } }> };
}
export interface ForecastItem { direction: "in" | "out"; party: string; docNo: string; amount: number; basis: string; date?: string }
export interface ForecastWeek { from: string; to: string; inflow: number; outflow: number; closing: number; top: ForecastItem[]; items?: ForecastItem[] }
export interface Forecast { opening: number; weeks: ForecastWeek[]; firstShortWeek: string | null; later: { inflow: number; outflow: number }; habits: number }
export interface CloseItem { key: string; label: string; detail: string; count: number; amount?: number; ok: boolean; link: string }
export interface CloseChecklist { month: string; from: string; to: string; items: CloseItem[]; done: number; total: number }
export interface RecurringExpense {
  _id: string; name: string; category: string | { _id: string; name: string }; description: string; supplier?: string | { _id: string; name: string } | null;
  payeeName?: string; amount: number; gstPercent?: number; every: 1 | 3 | 6 | 12; dayOfMonth: number; nextDate: string; endDate?: string | null; active: boolean;
  lastDrafted?: { expense?: string; expenseNo?: string; for?: string };
}
export interface AiSurfaceStats { surface: string; total?: number; accepted?: number; edited?: number; rejected?: number; failed?: number; pending?: number; acceptRate?: number | null }
