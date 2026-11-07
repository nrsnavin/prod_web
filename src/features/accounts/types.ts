// Mirrors api/accounts.js and the accounts models on the backend.

import type { InvoiceTotals, SupplyType } from "@/features/invoices/types";

export type AccountKind = "bank" | "cash" | "upi" | "card";
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
  /** The address the bank's emailed statements for this account come from. */
  statementFrom?: string;
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
  /** What GSTR-2B says about this bill, once the month's 2B is uploaded. */
  gstr2b?: { status: "" | "matched" | "mismatch" | "missing"; period?: string; diff?: number; note?: string; at?: string };
  /** Entered from a machine's service log. */
  machine?: string;
  serviceBill?: string;
  /** Credit reversed under Rule 37 (unpaid 180 days) and re-claimed when paid. */
  itcReversal?: { amount?: number; period?: string; at?: string; reclaimAmount?: number; reclaimPeriod?: string; reclaimAt?: string };
  /** Booked to an order, a machine or a department. */
  costCentre?: CostCentre;
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
  /** Booked to an order (by number), a machine or a department. */
  costCentre?: CostCentreInput;
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
  /** The machine service bill this is entered from (the file comes along). */
  serviceBill?: string;
  /** The bill from the bills mailbox this is entered from (the file comes along). */
  inboxBill?: string;
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
  /** Booked to an order, a machine or a department. */
  costCentre?: CostCentre;
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
  costCentre?: CostCentreInput;
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
  /** A financial credit note: past the GST time limit, no tax, not in GSTR-1. */
  financial?: boolean;
  /** A debit note charging interest on overdue invoices: the days each covered. */
  interest?: InterestMarker[];
}

export interface NoteCreateBody {
  kind: NoteKind;
  /** A debit note goes to a supplier unless this says customer. */
  partyType?: "customer" | "supplier";
  partyNoteNo?: string;
  against: { doc: string };
  reason: string;
  date?: string;
  /** Past the GST time limit: a financial credit note, no tax. */
  financial?: boolean;
  lines: LineInput[];
  notes?: string;
  requestId?: string;
  /** A debit note charging interest: which invoices and days it covers. */
  interest?: InterestMarker[];
}
export interface InterestMarker { invoice: string; docNo?: string; from: string; to: string; days: number; rate: number; amount: number }

export type VoucherKind = "receipt" | "payment";
export type PaymentMode = "cash" | "bank" | "upi" | "cheque" | "card";
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
  /** A cheque: held (post-dated), deposited, cleared or bounced. */
  cheque?: ChequeDetails;
  status: "posted" | "cancelled";
  cancel?: { reason?: string; at?: string };
  narration?: string;
  source?: string;
  fingerprints?: Fingerprint[];
}
/** held: received and in the drawer (a post-dated one until its date); deposited: with the bank; cleared: credited; bounced: returned. */
export type ChequeStatus = "" | "held" | "deposited" | "cleared" | "bounced";
export interface ChequeDetails { number?: string; bank?: string; date?: string; status: ChequeStatus; receivedOn?: string; depositedOn?: string; clearedOn?: string; bouncedOn?: string; bounceReason?: string; charges?: number }

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
  /** Entered from a payment advice: the reading it scores. */
  adviceSuggestion?: string;
  narration?: string;
  source?: string;
  statementLine?: string;
  requestId?: string;
  /** When the mode is cheque: its number, bank and date (dated ahead: held). A receipt's cheque is in hand until deposited, unless `deposited` says it already is. */
  cheque?: { number?: string; bank?: string; date?: string; deposited?: boolean };
  /** A refund: the credits on account it pays back (a payment to a customer, a receipt from a supplier). */
  refunds?: Array<{ sourceType: Credit["sourceType"]; id: string; amount: number }>;
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
  docType: "Invoice" | "SupplierBill" | "Expense" | "AccountNote" | "Payment" | "OpeningBalance" | "Journal";
  doc: string;
  /** For a journal row: the journal itself (doc is the line's own id). */
  source?: string;
  docNo: string;
  debit: number;
  credit: number;
  narration?: string;
  balance: number;
  /** Tally's columns: the other side of the entry ("To Sales", "By Kotak Bank") and the voucher type. */
  toBy?: "To" | "By";
  particulars?: string;
  vchType?: string;
  /** The party's own reference: their PO, the supplier's invoice number, the UTR or cheque. */
  partyRef?: string;
  /** A bounced cheque, shown and not counted: the cheque as entered, and its return. Debit and credit are 0. */
  memo?: "cheque-entered" | "cheque-returned";
  memoAmount?: number;
  /** Tally's detailed view: the voucher's other ledgers … */
  lines?: Array<{ ledger: string; amount: number }>;
  /** … and bill by bill what it settled or left on account. */
  refs?: Array<{ type: string; name: string; amount: number }>;
  balanceSide?: Side;
}
export type Side = "Dr" | "Cr" | "";
export interface Statement {
  party: { _id: string; name: string; gstin?: string };
  partyType: "customer" | "supplier";
  opening: number;
  openingSide?: Side;
  rows: LedgerRow[];
  totals?: { debit: number; credit: number };
  closing: number;
  closingSide?: Side;
  open: OutstandingTotals;
}
/** Tally's group summary: Sundry Debtors or Sundry Creditors, party by party. */
export interface GroupSummary {
  partyType: "customer" | "supplier";
  group: string;
  rows: Array<{ party: string; partyName: string; gstin: string; opening: number; openingSide: Side; debit: number; credit: number; closing: number; closingSide: Side }>;
  totals: { opening: number; openingSide: Side; debit: number; credit: number; closing: number; closingSide: Side };
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
    /** Rule 37: credit reversed on bills unpaid 180 days, and re-claimed once paid. */
    rule37?: { reversed: { cgst: number; sgst: number; igst: number; total: number }; reclaimed: { cgst: number; sgst: number; igst: number; total: number } };
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
  /** "other": a remembered payer or payee who is not a customer or supplier on file (the electricity board, the bank's interest). */
  partyType: "customer" | "supplier" | "other";
  party: string | null;
  partyName: string;
  allocations: Array<{ docType: Allocation["docType"]; doc: string; docNo: string; amount: number }>;
  confidence: number;
  reason: string;
  byModel?: boolean;
  /** Set when a remembered payer placed the line: the remembered entry's id. */
  remembered?: string;
  /** "contra": money between this account and another of ours (`account`). */
  kind?: "contra";
  account?: string;
  accountName?: string;
  /** Someone not on file: the expense head a payment goes under, or a receipt's income. */
  head?: string;
  headName?: string;
  incomeLedger?: "interest";
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
/**
 * How an upload sits against the account's last statement: whole days
 * neither covers, lines already brought in, and the opening balance less
 * the last closing (not zero: lines are missing between the two).
 */
export interface StatementContinuity {
  previous: { file: string; from: string; to: string; closingBalance: number | null } | null;
  from: string; to: string; openingBalance: number | null;
  gapDays: number; overlapLines: number; balanceDiff: number | null;
}
export interface StatementResult { statement?: string; account: { _id: string; name: string }; rows: StatementRow[]; counts: { recorded: number; matched: number; unmatched: number; ignored?: number }; file: string; closingBalance?: number | null; continuity?: StatementContinuity }
/** A payer or payee remembered from a statement line: narrations carrying `text` are this party. */
export interface BankAlias { _id: string; text: string; direction: "in" | "out"; partyType: "customer" | "supplier" | "other"; party: string | null; partyName: string; headName?: string; incomeLedger?: "" | "interest"; createdByName?: string; lastMatchedAt?: string | null; createdAt: string; updatedAt: string }
export interface StatementPostRow {
  /** The line's index on the stored statement. */
  index?: number;
  date: string; narration: string; ref: string; amount: number; direction: "in" | "out";
  partyType: "customer" | "supplier" | "other"; party?: string; partyName?: string;
  allocations?: Array<{ docType: Allocation["docType"]; doc: string; amount: number }>;
  requestId?: string;
  /** Remember: the next statement's lines carrying this text (it must be in the narration) are this party. */
  remember?: { text: string };
  /** Money between this account and another of ours: posted as a contra. */
  contra?: { account: string };
  /** Someone not on file: a payment's expense head, or a receipt that is interest. */
  head?: string;
  incomeLedger?: "interest";
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
  /** apply: what they paid ahead covers what is overdue — set it off, no one chases them. */
  next?: { action: "remind" | "call" | "escalate" | "apply"; tone: "gentle" | "firm"; label: string };
  /** What they have on account: advances, unused credit notes, opening advances. */
  onAccount?: number;
  covered?: boolean;
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
  | "debtorsGroup" | "creditorsGroup"
  | "salaries" | "salaryPayable" | "pfPayable" | "esiPayable" | "staffAdvances"
  | "depreciation" | "accumulatedDepreciation" | "stockInHand" | "closingStock" | "exportSales" | "interestReceived" | "chequeCharges";
export interface AccountsSettings {
  lockDate: string | null;
  lockedBy?: string;
  lockedAt?: string;
  tally: Record<TallyLedgerKey, string>;
  bills: { rateVariancePercent: number };
  /** HSN digits GSTR-1 must carry: 4 up to ₹5 crore turnover, 6 above. */
  gst?: { hsnDigits: 4 | 6 | 8 };
  /** A journal above this needs an admin to post it; 0 = anyone in accounts. */
  journals?: { approvalAbove: number };
  /** s.194Q: TDS on purchases of goods from one seller beyond the limit in a year. */
  tds?: { purchase194q: { enabled: boolean; limit: number; rate: number } };
  /** Send each bill's and expense's cost centre to Tally as an allocation. */
  costCentres?: { tally: boolean };
  /** Interest on overdue invoices, % a year, past the grace days; 0 = none. */
  receivables?: { interestRate: number; graceDays: number };
  /** The Letter of Undertaking exports go under, and the year it covers. */
  lut?: { number: string; validFrom: string | null; validTo: string | null };
}

// ── TDS after the deduction ──
export interface TdsRegister {
  month: string; due: string;
  rows: Array<{ section: string; deducted: number; count: number; deposited: number; interestPaid: number; balance: number; interestDue: number; late: boolean; challans: Array<{ _id: string; amount: number; interest: number; bsrCode: string; challanNo: string; depositedOn: string }> }>;
  totals: { deducted: number; deposited: number; balance: number; interestDue: number };
  vouchers: Array<{ _id: string; voucherNo: string; date: string; partyName: string; section: string; rate: number; base: number; tds: number; docs: string[] }>;
}
export interface Form26q {
  fy: string; quarter: "Q1" | "Q2" | "Q3" | "Q4"; from: string; to: string;
  rows: Array<{ voucherNo: string; date: string; supplier: string; deductee: string; pan: string; section: string; rate: number; amountPaid: number; tds: number; docs: string[]; challan: string }>;
  checks: Array<{ level: "error" | "warn"; doc: string; text: string }>;
  totals: { amountPaid: number; tds: number; deductees: number };
  certificates: TdsCertificateRow[];
}
export interface TdsCertificateRow { _id: string; kind: "issued" | "received"; partyType: "customer" | "supplier"; party: string; partyName: string; fy: string; quarter: string; certNo: string; section: string; amount: number; on: string; note?: string }
export interface TdsReceivable {
  fy: string; has26as: boolean; unmatched26as: number;
  rows: Array<{ customer: string; customerName: string; deducted: number; receipts: Array<{ voucherNo: string; date: string; amount: number }>; certificates: number; in26as: number; short26as: number; state: "no26as" | "matched" | "short" | "more" }>;
  totals: { deducted: number; certificates: number; in26as: number };
}
export interface Purchases194q {
  fy: string; settings: { enabled: boolean; limit: number; rate: number };
  rows: Array<{ supplier: string; supplierName: string; pan: string; purchases: number; bills: number; billsFlagged: number; over: number; crossed: boolean; tdsDue: number; tdsDeducted: number }>;
  totals: { crossed: number; tdsDue: number; tdsDeducted: number };
}

// ── Payroll into the books ──
export interface PayrollBooks {
  month: string; drafts: number; paid: number;
  totals: { people: number; gross: number; bonuses: number; pf: number; esi: number; advances: number; other: number; net: number; expense: number };
  journals: { salary: { _id: string; journalNo: string; date: string; total: number } | null; paid: { _id: string; journalNo: string; date: string; total: number } | null; salaryStale: boolean; paidStale: boolean };
  statutory: { due: string; pf: { due: number; deposited: number; late: boolean; rows: StatutoryDepositRow[] }; esi: { due: number; deposited: number; late: boolean; rows: StatutoryDepositRow[] }; pt: { deposited: number; rows: StatutoryDepositRow[] } };
}
export interface StatutoryDepositRow { _id: string; kind: "pf" | "esi" | "pt"; month: string; amount: number; challanNo: string; depositedOn: string }

export interface ServiceBillDraft {
  serviceBill: string; machine: string; kind: "service"; supplier: string | null; supplierName: string; vendor: string;
  supplierBillNo: string; billDate: string; amount: number; filename?: string; lines: Array<{ description: string; quantity: number; rate: number }>;
}
export interface CreditNoteLimit { invoiceNumber: string; limit: string; daysLeft: number; past: boolean; soon: boolean }

// ── Statutory ──
export interface MsmeDue {
  docType: "SupplierBill" | "Expense"; id: string; docNo: string; refNo: string; date: string; amount: number; outstanding: number;
  party: string; partyName: string; category: "micro" | "small"; udyam: string; days: number; dueDate: string; daysLeft: number; state: "ok" | "dueSoon" | "overdue";
}
export interface MsmeDues { rows: MsmeDue[]; totals: { count: number; outstanding: number; overdue: number; overdueCount: number; dueSoon: number }; suppliers: number }
export interface MsmeYearEnd {
  fy: string; from?: string; to?: string;
  rows: Array<{ id: string; docNo: string; refNo: string; party: string; partyName: string; category: string; date: string; dueDate: string; amount: number; paidByDue: number; paidLate: number; disallowed: number; lastPaid: string | null; status: "allowed" | "late" | "disallowed" }>;
  totals: { allowed: number; late: number; disallowed: number; count?: number; disallowedCount?: number };
}
export interface Gstr2bRow {
  _id: string; kind: "invoice" | "creditNote" | "debitNote"; supplierGstin: string; supplierName: string; number: string; date: string | null; value: number; taxable: number; tax: number; cgst: number; sgst: number; igst: number; itcAvailable: boolean; reason: string;
  match: { status: "matched" | "mismatch" | "notInBooks"; docType?: string; doc?: string; docNo?: string; diff?: number; by?: string; note?: string };
}
/** A supplier to ask to report or amend invoices missing from our GSTR-2B. */
export interface Gstr2bFollowUp {
  supplier: string; name: string; gstin: string; phone: string; email: string; tax: number; subject: string; message: string;
  bills: Array<{ _id: string; billNo: string; supplierBillNo: string; billDate: string; grand: number; tax: number; status: "missing" | "mismatch"; note: string }>;
}
export interface Gstr2bSummary {
  period: string; uploaded: boolean; uploadedAt: string | null;
  counts: { entries: number; matched: number; mismatch: number; notInBooks: number; missing: number };
  itc: { matched: number; mismatch: number; notInBooks: number; missing: number; unavailable: number };
  rows: Gstr2bRow[];
  missing: Array<{ _id: string; billNo: string; supplierBillNo: string; supplierName: string; supplierGstin: string; billDate: string; tax: number; grand: number; note: string }>;
  periods?: Array<{ period: string; entries: number; uploadedAt: string }>;
}
export interface ItcReversalMonth {
  month: string;
  toReverse: Array<{ _id: string; billNo: string; supplierBillNo: string; supplierName: string; billDate: string; day180: string; overdueDays: number; grand: number; outstanding: number; itc: number; reverse: number; inMonth: boolean }>;
  toReclaim: Array<{ _id: string; billNo: string; supplierBillNo: string; supplierName: string; billDate: string; reversed: number; reversedPeriod: string; outstanding: number; reclaim: number; fully: boolean }>;
  totals: { reverse: number; reclaim: number; reversed: number; reclaimed: number };
  done: { reversed: Array<{ _id: string; billNo: string; supplierName: string; amount: number; at: string }>; reclaimed: Array<{ _id: string; billNo: string; supplierName: string; amount: number; at: string }> };
}
export interface Gstr1Item { num: number; itm_det: { rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number } }
export interface Gstr1Invoice { inum: string; idt: string; val: number; pos: string; inv_typ?: string; itms: Gstr1Item[]; customer?: string; irn?: string }
export interface Gstr1Note { nt_num: string; nt_dt: string; ntty: "C" | "D"; val: number; pos: string; itms: Gstr1Item[]; against: string; party: string; reason: string; typ?: string }
export interface Gstr1 {
  month: string; fp: string; gstin: string; hsnDigits: number;
  b2b: Array<{ ctin: string; name: string; inv: Gstr1Invoice[] }>;
  b2cl: Array<{ pos: string; inv: Gstr1Invoice[] }>;
  b2cs: Array<{ sply_ty: string; pos: string; rt: number; txval: number; iamt: number; camt: number; samt: number; count: number }>;
  cdnr: Array<{ ctin: string; name: string; nt: Gstr1Note[] }>;
  cdnur: Gstr1Note[];
  hsn: Array<{ num: number; hsn_sc: string; desc: string; uqc: string; qty: number; rt: number; txval: number; iamt: number; camt: number; samt: number }>;
  docs: Array<{ doc_num: number; doc_typ: string; docs: Array<{ from: string; to: string; totnum: number; cancel: number; net_issue: number }> }>;
  /** Table 6A: exports, with (WPAY) or without (WOPAY) payment of tax. */
  exp: Array<{ exp_typ: "WPAY" | "WOPAY"; inv: Array<{ inum: string; idt: string; val: number; sbpcode: string; sbnum: string; sbdt: string; customer: string; irn: string; itms: Array<{ txval: number; rt: number; iamt: number; csamt: number }> }> }>;
  summary: Record<"b2b" | "b2cl" | "b2cs" | "exp" | "cdnr" | "cdnur", { count: number; val: number; txval: number; tax: number }>;
  checks: Array<{ level: "error" | "warn"; doc: string; text: string }>;
  counts: { invoices: number; cancelled: number; notes: number };
}

// ── Journal vouchers ──
export type JournalPurpose = "setoff" | "writeoff" | "accrual" | "salary" | "depreciation" | "stock" | "reclass" | "other";
export interface JournalLine {
  kind: "party" | "bank" | "head" | "ledger";
  ledger: string;
  partyType?: "customer" | "supplier"; customer?: string; supplier?: string; account?: string; category?: string;
  debit: number; credit: number;
  refs: Array<{ docType: SettleDocType; doc: string; docNo: string; amount: number }>;
  note?: string;
}
export interface Journal {
  _id: string; journalNo: string; date: string; purpose: JournalPurpose; narration: string; reason: string; lines: JournalLine[]; total: number;
  source?: string; sourceRef?: string; status: "posted" | "cancelled"; cancel?: { reason: string; at: string }; createdByName?: string; createdAt: string;
}
export interface JournalLineInput {
  kind: JournalLine["kind"]; ledger?: string; partyType?: "customer" | "supplier"; party?: string; account?: string; category?: string;
  debit?: number; credit?: number; refs?: Array<{ docType: SettleDocType; doc: string; amount: number }>; note?: string;
}

// ── Bank reconciliation ──
export interface StoredStatement {
  _id: string; account: string; accountName: string; file: string; source?: "upload" | "email" | "sftp"; from: string; to: string; openingBalance?: number | null; closingBalance: number | null;
  uploadedByName?: string; createdAt: string; lines: number; counts: Partial<Record<StatementRow["status"] | "posted", number>>;
}
/** One stored statement with its lines, as the server sends it. */
export type StoredStatementFull = Omit<StoredStatement, "lines" | "counts"> & { lines: StoredStatementLine[] };
export interface StoredStatementLine {
  index: number; date: string; narration: string; ref: string; amount: number; direction: "in" | "out"; balance: number | null;
  status: "recorded" | "posted" | "unmatched" | "matched" | "ignored"; voucherType: "Payment" | "Contra" | null; voucher: string | null; voucherNo: string; note: string;
  /** What the matcher proposed when the statement came in. */
  suggestion?: StatementSuggestion | null;
  candidates?: StatementRow["candidates"] | null;
}

// ── Statements by email ──
export interface BankFeedMail {
  _id: string; from: string; subject: string; receivedAt: string | null;
  /** A mail in the statements mailbox, or a file on the bank's SFTP server. */
  channel?: "email" | "sftp";
  status: "imported" | "nothing_new" | "skipped" | "failed";
  accountName?: string; account?: string | null; statement?: string | null;
  lines?: number; newLines?: number; posted?: number; note?: string;
}
export interface BankFeedRun {
  trigger: string; at: string; checked: number; imported: number; nothingNew: number; skipped: number; failed: number; newLines: number; posted: number; error?: string;
}
export interface BankFeedStatus {
  configured: boolean; mailbox: string; everyMin: number; senders: string[]; autoPost: boolean;
  /** The bank's SFTP folder, when one is set up; hostKeySet false means nothing is read yet. */
  sftp?: { host: string; dir: string; hostKeySet: boolean } | null;
  lastRunAt: string | null; lastResult: BankFeedRun | null; recent: BankFeedMail[];
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
  /** Bank accounts whose last statement is more than a week old, or which have none. */
  statementsDue?: { count: number; top: Array<{ account: string; accountName: string; lastTo: string | null }> };
  toChase: { count: number; amount: number; top: Array<{ party: string; partyName: string; overdue: number; oldestDays: number; next?: CollectionEntry["next"] }> };
  promisesDue: { count: number; top: Array<{ party: string; partyName: string; promise: NonNullable<CollectionEntry["promise"]> }> };
  variances: { count: number; top: Array<{ _id: string; billNo: string; supplierName: string; billDate: string; variance: { total: number; note?: string } }> };
  /** Bills to micro and small suppliers past, or within a week of, their 45-day limit. */
  msmeDue?: { count: number; overdue: number; amount: number; top: MsmeDue[] };
  /** Bills that came to the bills mailbox, read and waiting to be checked and entered. */
  mailedBills?: { count: number; amount: number; top: Array<{ _id: string; supplierName: string; from: string; receivedAt: string | null; grand: number | null; billNo: string; alreadyEntered: string | null; senderKnown: boolean }> };
  /** Bills on machines' service logs not yet entered as supplier bills. */
  serviceBills?: { count: number; amount: number; top: Array<{ _id: string; machine: string; serviceLog: string; kind: "service_bill" | "spare_bill"; vendor?: string; billNo?: string; billDate?: string | null; amount: number; filename?: string; createdAt: string }> };
  /** Cheques in the drawer whose date has come, or comes this week. */
  chequesDue?: { count: number; amount: number; overdue: number; top: Array<{ _id: string; kind: VoucherKind; voucherNo: string; partyName: string; amount: number; cheque: { number?: string; bank?: string; date: string } }> };
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

// ── Cost centres ──
export interface CostCentre { kind: "order" | "machine" | "department"; order?: string; orderNo?: number | null; machine?: string; department?: string; name: string }
export interface CostCentreInput { order?: string; orderNo?: number; machine?: string; department?: string }
export interface CostCentreGroup { key: string; name: string; ref: string | null; orderNo: number | null; total: number; count: number; docs: Array<{ docType: "SupplierBill" | "Expense"; id: string; docNo: string; date: string; party: string; kind: string; amount: number }> }
export interface CostCentreReport { from: string; to: string; orders: CostCentreGroup[]; machines: CostCentreGroup[]; departments: CostCentreGroup[]; allocated: number; unallocated: number; unallocatedCount: number; count: number }

// ── Fixed assets ──
export type AssetBlock = "building" | "plant" | "furniture" | "computer" | "server" | "vehicle" | "office" | "electrical" | "intangible";
export interface AssetYear {
  fy: string; days: number; fraction: number; halfRate: boolean;
  companiesAct: { opening: number; depreciation: number; closing: number; rate: number | null; method: "wdv" | "slm" };
  incomeTax: { opening: number; depreciation: number; closing: number; rate: number };
  disposal: { date: string; amount: number; wdv: number; gainLoss: number; itBlockAfter: number; itGain: number } | null;
}
export interface FixedAsset {
  _id: string; assetNo: string; name: string; description?: string; block: AssetBlock; method: "wdv" | "slm"; residualPercent: number; lifeYears?: number;
  purchaseDate: string; putToUse: string; cost: number; supplier?: string; supplierName?: string; supplierBill?: string; billNo?: string; machine?: string; location?: string; identifier?: string;
  openingWdv?: { fy?: string; companiesAct?: number; incomeTax?: number };
  status: "active" | "sold" | "scrapped"; disposal?: { date?: string; amount?: number; reason?: string };
}
export interface FixedAssetRow extends FixedAsset { year: AssetYear; blockLabel: string; addedThisYear: boolean }
export interface AssetBlockTotals { block: AssetBlock; label: string; itRate: number; count: number; cost: number; caOpening: number; caDep: number; caClosing: number; itOpening: number; itDep: number; itClosing: number }
export interface FixedAssetRegister {
  fy: string; from: string; to: string; rows: FixedAssetRow[]; blocks: AssetBlockTotals[];
  totals: { cost: number; caOpening: number; caDep: number; caClosing: number; itOpening: number; itDep: number; itClosing: number; additions: number; disposals: number };
  journal: { _id: string; journalNo: string; date: string; total: number } | null; journalStale: boolean; timingDifference: number;
  blockTable: Array<{ key: AssetBlock; label: string; itRate: number; life: number }>;
}
export interface FixedAssetBody { name: string; block: AssetBlock; method?: "wdv" | "slm"; residualPercent?: number; lifeYears?: number | ""; purchaseDate: string; putToUse?: string; cost: number; supplier?: string; supplierBill?: string; supplierName?: string; machine?: string; location?: string; identifier?: string; description?: string; openingWdv?: { fy: string; companiesAct: number; incomeTax?: number }; requestId?: string }

// ── Closing stock ──
export interface ClosingStock {
  asOf: string;
  rawMaterials: { rows: Array<{ id: string; name: string; category: string; unit: string; quantity: number; rate: number; basis: "average" | "price"; value: number }>; byCategory: Array<{ category: string; quantity: number; value: number; items: number }>; total: number };
  finishedGoods: { rows: Array<{ id: string; name: string; quantity: number; unit: string; rate: number; value: number; costingStatus: string }>; total: number };
  total: number; warnings: string[];
  journals: { closing: { journalNo: string; date: string; total: number } | null; opening: { journalNo: string; date: string; total: number } | null; stale: boolean };
  history: Array<{ _id: string; journalNo: string; date: string; total: number; asOf: string }>;
}

// ── Budgets ──
export interface BudgetRow { category: string; name: string; ledger: string; active: boolean; budget: number[]; actual: number[]; budgetTotal: number; actualTotal: number; ytdBudget: number; ytdActual: number; variance: number; used: number | null; overMonths: string[]; state: "over" | "near" | "ok" | "unbudgeted"; projected: number; note: string; count: number }
export interface BudgetCompare { fy: string; from: string; to: string; months: string[]; elapsed: number; rows: BudgetRow[]; totals: { budgetTotal: number; actualTotal: number; ytdBudget: number; ytdActual: number; variance: number; over: number; near: number; unbudgeted: number } }

// ── Balance confirmations ──
export type ConfirmationStatus = "draft" | "sent" | "confirmed" | "disputed";
export interface Confirmation {
  _id: string; confirmationNo: string; asOf: string; partyType: "customer" | "supplier"; customer?: string; supplier?: string; partyName: string; partyGstin?: string; balance: number; openCount: number; status: ConfirmationStatus;
  sent?: { at?: string; channel?: "" | "email" | "whatsapp" | "print"; to?: string; result?: string };
  reply?: { at?: string; theirBalance?: number; difference?: number; note?: string };
}
export interface ConfirmationRow { partyType: "customer" | "supplier"; party: string; partyName: string; gstin: string; email: string; phone: string; balance: number; confirmation: Confirmation | null }
export interface ConfirmationList { asOf: string; rows: ConfirmationRow[]; totals: { parties: number; none: number; draft: number; sent: number; confirmed: number; disputed: number; customers: number; suppliers: number } }
export interface ConfirmationLetter { confirmation: Confirmation; company: string; text: string; statement: { from: string; to: string; opening: number; closing: number; rows: Array<{ _id: string; date: string; docType: string; docNo: string; debit: number; credit: number; narration?: string; balance: number }> } }

// ── Cheques ──
export interface PdcRow { _id: string; kind: VoucherKind; voucherNo: string; date: string; partyType: string; partyName: string; amount: number; account?: string; accountName?: string; reference?: string; cheque: ChequeDetails; allocations?: Array<{ docNo: string }>; status: "posted" | "cancelled"; cancel?: { reason?: string } }
export interface PdcRegister { status: string; rows: PdcRow[]; totals: { held: { count: number; received: number; issued: number }; dueToday: { count: number; amount: number }; dueThisWeek: { count: number; amount: number } } }

// ── Interest on overdue receivables ──
export interface InterestRow { invoice: string; docNo: string; date: string; dueDate: string; outstanding: number; overdueDays: number; from: string; to: string; days: number; rate: number; interest: number; gstPercent: number; chargedTo: string | null }
export interface InterestDue { asOf: string; settings: { rate: number; graceDays: number }; groups: Array<{ party: string; partyName: string; rate: number; grace: number; rows: InterestRow[]; total: number; outstanding: number }>; total: number }
export interface InterestDraft { customer: string; partyName: string; asOf: string; total: number; rows: InterestRow[]; body: NoteCreateBody & { against: { doc: string; docNo: string } } }

// ── Sales and purchase registers ──
export interface RegisterRow {
  docType: "Invoice" | "AccountNote" | "SupplierBill" | "Expense"; id: string; kind: string; docNo: string; refNo?: string; date: string; party?: string; partyName: string; gstin: string; state: string; supplyType: string; exportKind?: string;
  orderNo?: number | null; poNo?: number | null; against?: string; head?: string; description?: string; costCentre?: string; financial?: boolean; interest?: boolean;
  taxable: number; cgst: number; sgst: number; igst: number; tax: number; roundOff: number; grand: number; byRate: Record<string, number>;
  irn?: string; ewaybill?: string; itc?: boolean; itcAmount?: number; reverseCharge?: boolean; rcmTax?: number; tds?: string; gstr2b?: string; itcReversed?: number;
  cancelled: boolean; sign: 1 | -1; outstanding: number;
}
export interface RegisterTotals { count: number; cancelled: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number; grand: number; byRate: Record<string, number>; itc?: number; reverseCharge?: number }
export interface Register { from: string; to: string; rows: RegisterRow[]; totals: RegisterTotals; counts: Record<string, number> }

/** A bill that came to the bills mailbox, read and matched (api/accounts.js /bill-inbox). */
export interface MailedBill {
  _id: string;
  status: "new" | "entered" | "dismissed" | "failed" | "skipped";
  note: string;
  from: string;
  subject: string;
  receivedAt: string | null;
  filename: string;
  contentType: string;
  supplier: string | null;
  supplierName: string;
  matchedBy: "gstin" | "name" | null;
  /** The sender's address is the supplier's on file. */
  senderKnown: boolean;
  alreadyEntered: string | null;
  grand: number | null;
  billNo: string;
  billDate: string | null;
  confidence: number | null;
  kind: "bill" | "receipt" | null;
  bill: string | null;
}

/** A customer's payment advice, read and placed on the books (POST /accounts/advice/read). */
export interface AdviceRead {
  problem: "not_an_advice" | "unreadable" | null;
  payerName: string;
  payerGstin: string;
  amount: number | null;
  date: string | null;
  reference: string;
  lines: Array<{ invoiceNo: string; invoiceDate: string | null; invoiceAmount: number | null; paid: number | null; tds: number | null; discount: number | null; other: number | null }>;
  confidence: number;
}
export interface AdvicePlaced {
  customer: { _id: string; name: string; gstin: string; matchedBy: "chosen" | "gstin" | "name" } | null;
  amount: number | null;
  date: string | null;
  reference: string;
  allocations: Array<{ docType: Allocation["docType"]; doc: string; docNo: string; amount: number; outstanding: number; paid: number | null; tds: number; discount: number; other: number }>;
  adjustments: Array<{ kind: AdjustmentKind; amount: number }>;
  unmatched: Array<{ invoiceNo: string; why: string; paid: number | null }>;
  notes: string[];
  difference: number | null;
  statementLine: { statement: string; account: string; accountName: string; key: string; date: string; narration: string; byReference: boolean } | null;
}
export interface AdviceResult { read: AdviceRead; placed: AdvicePlaced | null; aiSuggestion: string | null }

/** A supplier's statement of our account, read and set beside our books (POST /accounts/supplier-recon). */
export interface TheirEntry { date: string | null; docNo: string; kind: "invoice" | "payment" | "tds" | "credit_note" | "debit_note" | "opening" | "other"; debit: number; credit: number; narration: string }
export interface OurEntry { docType: string; doc: string; docNo: string; theirNo: string; date: string; debit: number; credit: number; narration: string }
export interface SupplierRecon {
  supplier: { _id: string; name: string; gstin: string };
  period: { from: string; to: string };
  matched: Array<{ theirs: TheirEntry; alsoTheirs?: TheirEntry; ours: OurEntry[]; by: string; difference: number; timing?: boolean }>;
  onlyTheirs: Array<TheirEntry & { likely: string }>;
  onlyOurs: Array<OurEntry & { likely: string }>;
  balances: { ours: number; theirs: number | null; difference: number | null; explained: number; unexplained: number | null };
  gstinDiffers: boolean;
}
export interface SupplierReconResult { read: { problem: string | null; partyName: string; from: string | null; to: string | null; entries: TheirEntry[] }; recon: SupplierRecon | null }

/** Opening balances set once from the dashboard (GET /accounts/opening-onboarding). */
export interface OpeningOnboardingParty {
  partyType: "customer" | "supplier";
  _id: string;
  name: string;
  gstin: string;
}
export interface OpeningOnboarding {
  active: boolean;
  completedAt?: string | null;
  /** This very call found none left and finished it. */
  justFinished?: boolean;
  leftWhenClosed?: number;
  asOn?: string;
  asOnSaved?: boolean;
  customers?: { total: number; left: number };
  suppliers?: { total: number; left: number };
  left?: OpeningOnboardingParty[];
  more?: number;
}

/** GET /accounts/banking: every account at a glance, and the cheques waiting to go to the bank. */
export interface BankingAccount extends BankAccount {
  balance: number;
  chequesInHand: { count: number; amount: number };
  chequesIssued: { count: number; amount: number };
  /** Vouchers the bank has not shown on a statement yet. */
  notOnStatement: number;
  lastStatement: string | null;
}
export interface ChequeInHand {
  _id: string;
  voucherNo: string;
  receivedOn: string;
  amount: number;
  partyName: string;
  account: string;
  accountName: string;
  chequeNo: string;
  bank: string;
  chequeDate: string;
  /** Its date has come: the bank will take it. */
  due: boolean;
}
export interface Banking {
  accounts: BankingAccount[];
  totals: { bank: number; cash: number; card: number; chequesInHand: number };
  inHand: ChequeInHand[];
}
export interface DepositSlip {
  _id: string;
  slipNo: string;
  date: string;
  account: string;
  accountName: string;
  bankSlipNo?: string;
  cheques: Array<{ payment: string; voucherNo: string; chequeNo: string; bank: string; chequeDate?: string; partyName: string; amount: number }>;
  cash: number;
  contraNo?: string;
  total: number;
}
