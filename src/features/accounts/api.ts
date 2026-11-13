import { httpClient } from "@/core/http/httpClient";
import { newRequestId } from "@/core/hooks/useRequestId";
import { MODEL_TIMEOUT_MS } from "@/core/http/timeouts";
import type {
  CollectionEntry, ScanResult, StatementPostRow, StatementPostResult, StatementResult, BankAlias,
  AccountNote, BankAccount, BillCreateBody, BillPoInfo, CashbookReport, DaybookReport, Expense, ExpenseCategory, ExpenseCreateBody,
  ExpenseReport, GstReport, NoteCreateBody, OpenDoc, OutstandingResult, Overview, Payment, PaymentCreateBody, Statement, SupplierBill, TdsReport,
  AccountsSettings, LockEvent, Contra, Credit, OpeningBalance, OpeningImportRow, OpeningOnboarding, Banking, DepositSlip,
  Reconciliation, StoredStatement, StoredStatementFull, BankFeedStatus, BankFeedRun, TallyBatch, TallyPreview, TallyConnectorStatus, TallyReconcile, BooksHealth,
  AiSurfaceStats, CloseChecklist, Flag, Forecast, Inbox, RecurringExpense, GroupSummary,
  MsmeDues, MsmeYearEnd, Gstr2bSummary, ItcReversalMonth, Gstr1, Journal, JournalDraft, JournalLineInput, JournalPurpose,
  TdsRegister, Form26q, TdsCertificateRow, TdsReceivable, Purchases194q, PayrollBooks, StatutoryDepositRow, ServiceBillDraft, CreditNoteLimit,
  FixedAssetRegister, FixedAsset, FixedAssetBody, AssetYear, ClosingStock, BudgetCompare, CostCentreReport, ConfirmationList, Confirmation, ConfirmationLetter,
  PdcRegister, Payment as PaymentDoc, InterestDue, InterestDraft, Register, MailedBill, AdviceResult, SupplierReconResult, Gstr2bFollowUp, ReadyMailedBill } from "./types";
import { uploadForm } from "@/core/http/upload";
import { apiUrl } from "@/app/config";

type Page<K extends string, T> = { success: boolean; total: number; page: number; pages: number } & Record<K, T[]>;

const clean = (q: Record<string, unknown>) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== "" && v !== "all"));

// One id for one event. A posting sent twice — a second click, a resend
// after a timeout whose first attempt did land — carries the same id,
// and the server answers the second with what the first made. The id is
// kept while the same thing is sent again unchanged, and let go once it
// has gone through: the next send is a new event. (The forms that go
// through useAccountsMutations keep theirs with useRequestId; these are
// the calls made straight from a screen, which sent none.)
const pendingIds = new Map<string, string>();
async function once<B extends object, T>(what: string, body: B, send: (b: B & { requestId: string }) => Promise<T>): Promise<T> {
  const sig = `${what}:${JSON.stringify(body)}`;
  const requestId = pendingIds.get(sig) ?? newRequestId();
  pendingIds.set(sig, requestId);
  const out = await send({ ...body, requestId });
  pendingIds.delete(sig);
  return out;
}

export const accountsService = {
  overview: () => httpClient.get<Overview & { success: boolean }>("/accounts/overview"),

  // ── Masters ──
  bankAccounts: async () => (await httpClient.get<{ success: boolean; accounts: BankAccount[] }>("/accounts/bank-accounts")).accounts,
  createBankAccount: async (body: Partial<BankAccount>) => (await httpClient.post<{ success: boolean; account: BankAccount }>("/accounts/bank-accounts", body)).account,
  updateBankAccount: async (id: string, body: Partial<BankAccount>) => (await httpClient.put<{ success: boolean; account: BankAccount }>(`/accounts/bank-accounts/${id}`, body)).account,
  // Banking: every account at a glance; deposits of cheques and cash.
  banking: async () => (await httpClient.get<{ success: boolean } & Banking>("/accounts/banking")) as Banking,
  deposits: async (q: { account?: string; page?: number } = {}) => httpClient.get<{ success: boolean; slips: DepositSlip[]; total: number; pages: number }>("/accounts/deposits", clean(q)),
  createDeposit: async (body: { account: string; date: string; cheques: string[]; cash?: number; cashFrom?: string; bankSlipNo?: string; requestId?: string }) =>
    (await httpClient.post<{ success: boolean; slip: DepositSlip }>("/accounts/deposits", body)).slip,
  /** A slip made by mistake, taken back whole: its cheques are in hand again and its cash contra is cancelled with it. */
  cancelDeposit: (id: string, reason: string) =>
    httpClient.post<{ success: boolean; slip: DepositSlip; chequesBack: string[]; note?: string }>(`/accounts/deposits/${id}/cancel`, { reason }),
  depositPdfUrl: (id: string) => apiUrl(`/accounts/deposits/${id}/pdf`),
  categories: async () => (await httpClient.get<{ success: boolean; categories: ExpenseCategory[] }>("/accounts/categories")).categories,
  createCategory: async (body: Partial<ExpenseCategory>) => (await httpClient.post<{ success: boolean; category: ExpenseCategory }>("/accounts/categories", body)).category,
  updateCategory: async (id: string, body: Partial<ExpenseCategory>) => (await httpClient.put<{ success: boolean; category: ExpenseCategory }>(`/accounts/categories/${id}`, body)).category,

  // ── Bills ──
  bills: (q: Record<string, unknown>) => httpClient.get<Page<"bills", SupplierBill>>("/accounts/bills", clean(q)),
  bill: async (id: string) => httpClient.get<{ success: boolean; bill: SupplierBill; payments: Array<Payment & Partial<{ amount: number; tds: number }>>; notes: AccountNote[] }>(`/accounts/bills/${id}`),
  billPoInfo: (poId: string) => httpClient.get<BillPoInfo & { success: boolean }>("/accounts/bills/po-info", { id: poId }),
  // `warnings`: the bill is entered, but something beside it did not happen (the mailed file or the
  // service log's photo could not be attached) and is for the person to do by hand.
  createBill: async (body: BillCreateBody): Promise<SupplierBill & { warnings?: string[] }> => {
    const r = await httpClient.post<{ success: boolean; bill: SupplierBill; warnings?: string[] }>("/accounts/bills", body);
    return r.warnings?.length ? { ...r.bill, warnings: r.warnings } : r.bill;
  },
  cancelBill: async (id: string, reason: string) => (await httpClient.post<{ success: boolean; bill: SupplierBill }>(`/accounts/bills/${id}/cancel`, { reason })).bill,

  // ── Expenses ──
  expenses: (q: Record<string, unknown>) => httpClient.get<Page<"expenses", Expense> & { pendingCount: number }>("/accounts/expenses", clean(q)),
  expense: (id: string) => httpClient.get<{ success: boolean; expense: Expense; payments: Payment[] }>(`/accounts/expenses/${id}`),
  createExpense: (body: ExpenseCreateBody) => httpClient.post<{ success: boolean; expense: Expense; voucher: { _id: string; voucherNo: string } | null }>("/accounts/expenses", body),
  approveExpense: (id: string, body: { note?: string; payNow?: { account: string; mode?: string; reference?: string } } = {}) =>
    httpClient.post<{ success: boolean; expense: Expense; voucher: { _id: string; voucherNo: string } | null }>(`/accounts/expenses/${id}/approve`, body),
  rejectExpense: (id: string, reason: string) => httpClient.post<{ success: boolean; expense: Expense }>(`/accounts/expenses/${id}/reject`, { reason }),
  payExpense: (id: string, body: { account: string; mode?: string; reference?: string; date?: string; confirmRisk?: boolean; riskNote?: string }) =>
    once(`pay-expense:${id}`, body, (b) => httpClient.post<{ success: boolean; expense: Expense; voucher: { _id: string; voucherNo: string }; replay?: boolean }>(`/accounts/expenses/${id}/pay`, b)),
  cancelExpense: (id: string, reason: string) => httpClient.post<{ success: boolean; expense: Expense }>(`/accounts/expenses/${id}/cancel`, { reason }),

  // ── Notes ──
  notes: (q: Record<string, unknown>) => httpClient.get<Page<"notes", AccountNote>>("/accounts/notes", clean(q)),
  note: (id: string) => httpClient.get<{ success: boolean; note: AccountNote }>(`/accounts/notes/${id}`),
  createNote: async (body: NoteCreateBody) => (await httpClient.post<{ success: boolean; note: AccountNote }>("/accounts/notes", body)).note,
  cancelNote: async (id: string, reason: string) => (await httpClient.post<{ success: boolean; note: AccountNote }>(`/accounts/notes/${id}/cancel`, { reason })).note,

  // ── Vouchers ──
  payments: (q: Record<string, unknown>) => httpClient.get<Page<"payments", Payment>>("/accounts/payments", clean(q)),
  payment: (id: string) => httpClient.get<{ success: boolean; payment: Payment }>(`/accounts/payments/${id}`),
  openDocs: (partyType: "customer" | "supplier", party: string) =>
    httpClient.get<{ success: boolean; docs: OpenDoc[]; balance: number; credits?: Credit[] }>("/accounts/payments/open-docs", { partyType, party }),
  createPayment: async (body: PaymentCreateBody) => (await httpClient.post<{ success: boolean; payment: Payment }>("/accounts/payments", body)).payment,
  cancelPayment: async (id: string, reason: string) => (await httpClient.post<{ success: boolean; payment: Payment }>(`/accounts/payments/${id}/cancel`, { reason })).payment,

  // ── Ledgers and reports ──
  statement: (partyType: "customer" | "supplier", party: string, range: { from?: string; to?: string }) =>
    httpClient.get<Statement & { success: boolean }>("/accounts/statement", clean({ partyType, party, ...range })),
  outstanding: (type: "receivable" | "payable", party?: string) =>
    httpClient.get<OutstandingResult & { success: boolean }>("/accounts/outstanding", clean({ type, party })),
  gst: (range: { from?: string; to?: string }) => httpClient.get<GstReport & { success: boolean }>("/accounts/reports/gst", clean(range)),
  tds: (range: { from?: string; to?: string }) => httpClient.get<TdsReport & { success: boolean }>("/accounts/reports/tds", clean(range)),
  expenseReport: (range: { from?: string; to?: string }) => httpClient.get<ExpenseReport & { success: boolean }>("/accounts/reports/expenses", clean(range)),
  cashbook: (account: string, range: { from?: string; to?: string }) => httpClient.get<CashbookReport & { success: boolean }>("/accounts/reports/cashbook", clean({ account, ...range })),
  daybook: (date: string) => httpClient.get<DaybookReport & { success: boolean }>("/accounts/reports/daybook", { date }),

  // ── Bills by mail ──
  mailedBills: async (status: MailedBill["status"] = "new") => (await httpClient.get<{ success: boolean; bills: MailedBill[] }>("/accounts/bill-inbox", { status })).bills,
  mailedBill: (id: string) => httpClient.get<ScanResult & { success: boolean; item: MailedBill }>(`/accounts/bill-inbox/${encodeURIComponent(id)}`),
  mailedBillFileUrl: (id: string) => apiUrl(`/accounts/bill-inbox/${encodeURIComponent(id)}/file`),
  /** The mailed bills nothing is left to decide on, each with the body POST /accounts/bills takes. */
  readyMailedBills: async () => (await httpClient.get<{ success: boolean; bills: ReadyMailedBill[]; waiting: number }>("/accounts/bill-inbox/ready")).bills,
  dismissMailedBill: (id: string, reason: string) => httpClient.post<{ success: boolean }>(`/accounts/bill-inbox/${encodeURIComponent(id)}/dismiss`, { reason }),
  billMailboxStatus: () => httpClient.get<{ success: boolean; configured: boolean; mailbox: string; everyMin: number; waiting: number }>("/accounts/bill-inbox/status"),
  readBillMailbox: () => httpClient.post<{ success: boolean; mails: number; bills: number; errors: string[] }>("/accounts/bill-inbox/run", {}),

  // ── AI ──
  /** A customer's payment advice — files, or its text pasted — read and placed on the books. */
  async readAdvice(input: { files?: File[]; text?: string; customer?: string }): Promise<AdviceResult> {
    const fd = new FormData();
    for (const f of input.files ?? []) fd.append("files", f);
    if (input.text) fd.append("text", input.text);
    if (input.customer) fd.append("customer", input.customer);
    return uploadForm<AdviceResult>("/accounts/advice/read", fd, "Could not read the advice");
  },
  /** A supplier's statement of our account set beside our books. */
  async reconcileSupplier(supplier: string, files: File[]): Promise<SupplierReconResult> {
    const fd = new FormData();
    fd.append("supplier", supplier);
    for (const f of files) fd.append("files", f);
    return uploadForm<SupplierReconResult>("/accounts/supplier-recon", fd, "Could not read their statement");
  },
  /** `qr`: an e-invoice QR code found in the photo on this device, as its text; the server reads it again. */
  async scan(files: File[], qr?: string | null): Promise<ScanResult> {
    const fd = new FormData();
    if (qr) fd.append("qr", qr);
    for (const f of files) fd.append("files", f);
    return uploadForm<ScanResult>("/accounts/scan", fd, "Could not read the bill");
  },
  async uploadStatement(account: string, file: File, useModel = true): Promise<StatementResult> {
    const fd = new FormData();
    fd.append("account", account);
    fd.append("useModel", String(useModel));
    fd.append("file", file);
    return uploadForm<StatementResult>("/accounts/bank/statement", fd, "Could not read the statement");
  },
  postStatement: (account: string, rows: StatementPostRow[], statement?: string) =>
    httpClient.post<{ success: boolean; results: StatementPostResult[]; posted: number; failed: number }>("/accounts/bank/statement/post", { account, rows, statement }),
  statements: async (account?: string) => (await httpClient.get<{ success: boolean; statements: StoredStatement[] }>("/accounts/bank/statements", clean({ account }))).statements,
  storedStatement: async (id: string) => (await httpClient.get<{ success: boolean; statement: StoredStatementFull }>(`/accounts/bank/statements/${id}`)).statement,
  rematchStatement: async (id: string) => (await httpClient.post<{ success: boolean; changed: number; statement: StoredStatementFull }>(`/accounts/bank/statements/${id}/rematch`, {})),
  bankAliases: async () => (await httpClient.get<{ success: boolean; aliases: BankAlias[] }>("/accounts/bank/aliases")).aliases,
  forgetBankAlias: (id: string) => httpClient.delete<{ success: boolean }>(`/accounts/bank/aliases/${id}`),
  ignoreLine: (statement: string, index: number, reason: string) => httpClient.post<{ success: boolean }>(`/accounts/bank/statements/${statement}/lines/${index}/ignore`, { reason }),
  linkLine: (statement: string, index: number, voucherType: "Payment" | "Contra", voucher: string) =>
    httpClient.post<{ success: boolean }>(`/accounts/bank/statements/${statement}/lines/${index}/link`, { voucherType, voucher }),
  /** A wrong match undone: the line goes back to be placed, and the entry is free to answer its own line. */
  unlinkLine: (statement: string, index: number) => httpClient.post<{ success: boolean }>(`/accounts/bank/statements/${statement}/lines/${index}/unlink`, {}),
  bankFeed: async () => (await httpClient.get<{ success: boolean; feed: BankFeedStatus }>("/accounts/bank/feed")).feed,
  runBankFeed: async () => httpClient.post<{ success: boolean; result: BankFeedRun; feed: BankFeedStatus }>("/accounts/bank/feed/run", {}),
  setBankFeed: async (body: { autoPost: boolean }) => (await httpClient.put<{ success: boolean; feed: BankFeedStatus }>("/accounts/bank/feed", body)).feed,
  clearEntry: (body: { voucherType: "Payment" | "Contra"; id: string; account: string; clearedOn: string | null }) => httpClient.post<{ success: boolean }>("/accounts/bank/clear", body),
  reconciliation: (account: string, asOf: string, bankBalance?: number | "") =>
    httpClient.get<Reconciliation & { success: boolean }>("/accounts/bank/reconciliation", clean({ account, asOf, bankBalance })),

  // ── Tally ──
  tallyPreview: (range: { from: string; to: string }) => httpClient.get<TallyPreview & { success: boolean }>("/accounts/tally/preview", range),
  tallyExport: async (body: { from: string; to: string; lock?: boolean; masters?: boolean; via?: "file" | "connector" }) =>
    (await httpClient.post<{ success: boolean; batch: TallyBatch }>("/accounts/tally/export", body)).batch,
  tallyBatches: async () => (await httpClient.get<{ success: boolean; batches: TallyBatch[] }>("/accounts/tally/batches")).batches,
  tallyXml: (id: string) => httpClient.getBlob(`/accounts/tally/batches/${id}/xml`),
  tallyRequeue: (id: string) => httpClient.post<{ success: boolean }>(`/accounts/tally/batches/${id}/requeue`, {}),
  tallyConnector: async () => (await httpClient.get<{ success: boolean; connector: TallyConnectorStatus }>("/accounts/tally/connector")).connector,
  tallyConnectorKey: async () => (await httpClient.post<{ success: boolean; key: string; connector: TallyConnectorStatus }>("/accounts/tally/connector/key", {})),
  tallyConnectorRevoke: () => httpClient.delete<{ success: boolean }>("/accounts/tally/connector/key"),
  tallyConnectorScript: () => httpClient.getBlob("/accounts/tally/connector/script"),
  tallyReconcile: async () => (await httpClient.get<{ success: boolean } & TallyReconcile>("/accounts/tally/reconcile")),
  booksHealth: async () => (await httpClient.get<{ success: boolean } & BooksHealth>("/accounts/health")),
  booksRepair: (key: "repair" | "rebuild") => httpClient.post<{ success: boolean; fixed?: number; rows?: number }>(`/accounts/health/${key}`, {}),
  autoRemind: () => httpClient.get<{
    success: boolean; whatsapp: boolean; more: number;
    settings: { enabled?: boolean; hour?: number; everyDays?: number; minOverdueDays?: number; lastRunDate?: string; acknowledgeReplies?: boolean; assistant?: boolean };
    send: Array<{ party: string; partyName: string; overdue: number; oldestDays: number; tone: string; phone: string }>;
    skip: Array<{ party: string; partyName: string; overdue: number; why: string }>;
  }>("/accounts/collections/auto-remind"),
  runAutoRemind: () => httpClient.post<{ success: boolean; sent?: number; why?: string }>("/accounts/collections/auto-remind/run", {}),
  collections: (held = false) => httpClient.get<{ success: boolean; rows: CollectionEntry[]; total: number; whatsapp: boolean }>("/accounts/collections", held ? { held: "true" } : undefined),
  draftReminder: (customer: string, tone: "gentle" | "firm" = "gentle") =>
    httpClient.post<{ success: boolean; message: string; byModel: boolean; to: string; entry: CollectionEntry }>("/accounts/collections/draft", { customer, tone }, { timeoutMs: MODEL_TIMEOUT_MS }),
  sendReminder: (to: string, message: string, extra: { customer?: string; tone?: string } = {}) =>
    httpClient.post<{ success: boolean; sent: boolean; dryRun?: boolean; error?: string; to: string }>("/accounts/collections/send", { to, message, ...extra }),
  logCollection: (body: { customer: string; kind: "call" | "promise" | "note"; note?: string; promiseDate?: string; promiseAmount?: number; channel?: string }) =>
    httpClient.post<{ success: boolean }>("/accounts/collections/log", body),
  collectionHistory: async (customer: string) =>
    (await httpClient.get<{ success: boolean; history: Array<{ _id: string; kind: string; channel?: string; note?: string; message?: string; promiseDate?: string; promiseAmount?: number; result?: string; byName?: string; createdAt: string }> }>(`/accounts/collections/${customer}/history`)).history,

  // ── Credits ──
  credits: async (partyType: "customer" | "supplier", party: string) =>
    (await httpClient.get<{ success: boolean; credits: Credit[] }>("/accounts/credits", { partyType, party })).credits,
  applyCredit: (body: { source: { type: Credit["sourceType"]; id: string }; allocations: Array<{ docType: OpenDoc["docType"]; doc: string; amount: number }> }) =>
    once("apply-credit", body, (b) => httpClient.post<{ success: boolean; applied: number; source: { docNo: string }; replay?: boolean }>("/accounts/credits/apply", b)),

  // ── Contras ──
  contras: (q: Record<string, unknown>) => httpClient.get<Page<"contras", Contra>>("/accounts/contras", clean(q)),

  // ── Journal vouchers ──
  journals: (q: Record<string, unknown>) => httpClient.get<Page<"journals", Journal>>("/accounts/journals", clean(q)),
  journal: async (id: string) => (await httpClient.get<{ success: boolean; journal: Journal }>(`/accounts/journals/${id}`)).journal,
  /** Narrations for the journal being written: the house's own for the same ledgers first. */
  journalNarration: async (body: { purpose?: JournalPurpose; lines: JournalLineInput[] }) =>
    httpClient.post<{ suggestions: { text: string; from: "past" | "model" | "rule" }[]; aiSuggestion: string | null }>("/accounts/journals/narration", body, { timeoutMs: MODEL_TIMEOUT_MS }),
  createJournal: async (body: { date?: string; purpose?: JournalPurpose; narration?: string; reason: string; lines: JournalLineInput[]; requestId?: string; aiSuggestion?: string }) =>
    (await httpClient.post<{ success: boolean; journal: Journal }>("/accounts/journals", body)).journal,
  cancelJournal: async (id: string, reason: string) => (await httpClient.post<{ success: boolean; journal: Journal }>(`/accounts/journals/${id}/cancel`, { reason })).journal,

  // ── Statutory ──
  msme: () => httpClient.get<MsmeDues & { success: boolean }>("/accounts/msme"),
  msmeYearEnd: (fy?: string) => httpClient.get<MsmeYearEnd & { success: boolean }>("/accounts/msme/year-end", clean({ fy })),
  msmeForm1Url: (asOf?: string) => apiUrl(`/accounts/msme/form1?format=xlsx${asOf ? `&asOf=${asOf}` : ""}`),
  gstr2b: (period?: string) => httpClient.get<Gstr2bSummary & { success: boolean }>("/accounts/gstr2b", clean({ period })),
  async uploadGstr2b(file: File, period?: string): Promise<Gstr2bSummary> {
    const fd = new FormData();
    if (period) fd.append("period", period);
    fd.append("file", file);
    return uploadForm<Gstr2bSummary>("/accounts/gstr2b/upload", fd, "Could not read the GSTR-2B file");
  },
  gstr2bFollowUps: async (period: string) => (await httpClient.get<{ success: boolean; suppliers: Gstr2bFollowUp[] }>("/accounts/gstr2b/follow-ups", { period })).suppliers,
  reconcileGstr2b: (period: string) => httpClient.post<Gstr2bSummary & { success: boolean }>("/accounts/gstr2b/reconcile", { period }),
  itcReversal: (month?: string) => httpClient.get<ItcReversalMonth & { success: boolean }>("/accounts/itc-reversal", clean({ month })),
  // `amount` is the step just recorded; `reversed` and `reclaimed` the bill's running totals after it.
  itcReverse: (bill: string, month: string) => httpClient.post<{ success: boolean; billNo: string; amount: number; period?: string; reversed?: number; reclaimed?: number }>(`/accounts/bills/${bill}/itc-reverse`, { month }),
  itcReclaim: (bill: string, month: string) => httpClient.post<{ success: boolean; billNo: string; amount: number; period?: string; reversed?: number; reclaimed?: number }>(`/accounts/bills/${bill}/itc-reclaim`, { month }),
  gstr1: (month?: string) => httpClient.get<Gstr1 & { success: boolean }>("/accounts/gstr1", clean({ month })),
  gstr1JsonUrl: (month: string) => apiUrl(`/accounts/gstr1/json?month=${month}`),
  tdsRegister: (month?: string) => httpClient.get<TdsRegister & { success: boolean }>("/accounts/tds/register", clean({ month })),
  addTdsChallan: (body: { month: string; section: string; amount: number; interest?: number; bsrCode?: string; challanNo?: string; depositedOn: string; account?: string }) =>
    once("tds-challan", body, (b) => httpClient.post<{ success: boolean; register: TdsRegister; replay?: boolean }>("/accounts/tds/challans", b)),
  form26q: (fy?: string, q?: string) => httpClient.get<Form26q & { success: boolean }>("/accounts/tds/26q", clean({ fy, q })),
  form26qXlsxUrl: (fy: string, q: string) => apiUrl(`/accounts/tds/26q?fy=${fy}&q=${q}&format=xlsx`),
  tdsCertificates: async (fy?: string) => (await httpClient.get<{ success: boolean; fy: string; rows: TdsCertificateRow[] }>("/accounts/tds/certificates", clean({ fy }))).rows,
  addTdsCertificate: (body: { kind: "issued" | "received"; party: string; fy: string; quarter: string; certNo?: string; section?: string; amount: number; on?: string; note?: string }) =>
    once("tds-certificate", body, (b) => httpClient.post<{ success: boolean; certificate: TdsCertificateRow; replay?: boolean }>("/accounts/tds/certificates", b)),
  tdsReceivable: (fy?: string) => httpClient.get<TdsReceivable & { success: boolean }>("/accounts/tds/receivable", clean({ fy })),
  async upload26as(file: File, fy: string): Promise<{ lines: number; matched: number; unmatched: Array<{ deductorName: string; tan: string; tds: number }>; receivable: TdsReceivable }> {
    const fd = new FormData();
    fd.append("fy", fy);
    fd.append("file", file);
    return uploadForm("/accounts/tds/26as", fd, "Could not read the 26AS file");
  },
  purchases194q: (fy?: string) => httpClient.get<Purchases194q & { success: boolean }>("/accounts/tds/194q", clean({ fy })),
  payrollBooks: (month?: string) => httpClient.get<PayrollBooks & { success: boolean }>("/accounts/payroll-books", clean({ month })),
  postPayrollSalary: (month: string) => httpClient.post<{ success: boolean; journal: Journal; summary: PayrollBooks }>("/accounts/payroll-books/salary", { month }),
  postPayrollPaid: (month: string) => httpClient.post<{ success: boolean; journal: Journal; summary: PayrollBooks }>("/accounts/payroll-books/paid", { month }),
  addStatutoryDeposit: (body: { kind: "pf" | "esi" | "pt"; month: string; amount: number; challanNo?: string; depositedOn: string }) =>
    once("statutory-deposit", body, (b) => httpClient.post<{ success: boolean; deposit: StatutoryDepositRow; summary: PayrollBooks; replay?: boolean }>("/accounts/payroll-books/deposits", b)),
  serviceBillDraft: (id: string) => httpClient.get<{ success: boolean; entered: string | null; draft: ServiceBillDraft | null }>(`/accounts/service-bills/${id}/draft`),
  creditNoteLimit: (invoice: string) => httpClient.get<CreditNoteLimit & { success: boolean }>("/accounts/credit-note-limit", { invoice }),
  gstr1XlsxUrl: (month: string) => apiUrl(`/accounts/gstr1/xlsx?month=${month}`),

  // ── Registers: fixed assets, closing stock, budgets, cost centres ──
  fixedAssets: (fy?: string) => httpClient.get<FixedAssetRegister & { success: boolean }>("/accounts/fixed-assets", clean({ fy })),
  fixedAssetsXlsxUrl: (fy: string) => apiUrl(`/accounts/fixed-assets/register.xlsx?fy=${fy}`),
  fixedAsset: (id: string) => httpClient.get<{ success: boolean; asset: FixedAsset; years: AssetYear[] }>(`/accounts/fixed-assets/${id}`),
  addFixedAsset: (body: FixedAssetBody) => httpClient.post<{ success: boolean; asset: FixedAsset; year: AssetYear }>("/accounts/fixed-assets", body),
  // Disposing records the day and the price and posts nothing: `journal` is the draft that takes it off the books.
  disposeFixedAsset: (id: string, body: { how: "sold" | "scrapped"; date: string; amount?: number; reason?: string }) => httpClient.post<{ success: boolean; asset: FixedAsset; year: AssetYear; journal?: JournalDraft | null }>(`/accounts/fixed-assets/${id}/dispose`, body),
  disposalJournal: async (id: string) => (await httpClient.get<{ success: boolean; journal: JournalDraft }>(`/accounts/fixed-assets/${id}/disposal-journal`)).journal,
  // One journal an asset: the same again is answered by the one in the books (`replay`), a changed one takes its place (`replaced`).
  postDisposalJournal: (id: string, body: { lines: JournalLineInput[]; narration?: string; reason?: string }) =>
    httpClient.post<{ success: boolean; journal: Journal; replaced: string | null; replay?: boolean }>(`/accounts/fixed-assets/${id}/disposal-journal`, body),
  postDepreciation: (fy: string) => httpClient.post<{ success: boolean; journal: Journal; register: FixedAssetRegister }>("/accounts/fixed-assets/depreciation", { fy }),
  closingStock: (asOf?: string) => httpClient.get<ClosingStock & { success: boolean }>("/accounts/closing-stock", clean({ asOf })),
  postClosingStock: (asOf: string) => httpClient.post<{ success: boolean; closing: Journal; opening: Journal; valuation: ClosingStock }>("/accounts/closing-stock", { asOf }),
  budgets: (fy?: string) => httpClient.get<BudgetCompare & { success: boolean }>("/accounts/budgets", clean({ fy })),
  saveBudgets: (fy: string, rows: Array<{ category: string; amounts?: number[]; annual?: number; note?: string }>) => httpClient.put<BudgetCompare & { success: boolean }>("/accounts/budgets", { fy, rows }),
  costCentres: (from?: string, to?: string) => httpClient.get<CostCentreReport & { success: boolean }>("/accounts/cost-centres", clean({ from, to })),

  // ── Confirmations, cheques, interest ──
  confirmations: (asOf?: string) => httpClient.get<ConfirmationList & { success: boolean }>("/accounts/confirmations", clean({ asOf })),
  createConfirmations: (body: { asOf: string; partyType?: "customer" | "supplier" | "both"; parties?: string[]; all?: boolean }) => httpClient.post<ConfirmationList & { success: boolean; made: Confirmation[]; skipped: number }>("/accounts/confirmations", body),
  confirmationLetter: (id: string) => httpClient.get<ConfirmationLetter & { success: boolean }>(`/accounts/confirmations/${id}/letter`),
  sendConfirmation: async (id: string, body: { channel: "email" | "whatsapp" | "print"; to?: string }) => (await httpClient.post<{ success: boolean; confirmation: Confirmation }>(`/accounts/confirmations/${id}/send`, body)).confirmation,
  replyConfirmation: async (id: string, body: { status: "confirmed" | "disputed"; theirBalance?: number | ""; note?: string }) => (await httpClient.post<{ success: boolean; confirmation: Confirmation }>(`/accounts/confirmations/${id}/reply`, body)).confirmation,
  pdc: (status?: string) => httpClient.get<PdcRegister & { success: boolean }>("/accounts/pdc", clean({ status })),
  chequeAction: (id: string, body: { action: "deposited" | "cleared" | "bounced"; on?: string; account?: string; reason?: string; charges?: number }) => httpClient.post<{ success: boolean; payment: PaymentDoc; bounced?: boolean }>(`/accounts/payments/${id}/cheque`, body),
  interest: (asOf?: string, customer?: string) => httpClient.get<InterestDue & { success: boolean }>("/accounts/interest", clean({ asOf, customer })),
  interestDraft: (customer: string, asOf?: string) => httpClient.get<InterestDraft & { success: boolean }>("/accounts/interest/draft", clean({ customer, asOf })),
  register: (kind: "sales" | "purchase", from?: string, to?: string) => httpClient.get<Register & { success: boolean }>(`/accounts/registers/${kind}`, clean({ from, to })),
  registerXlsxUrl: (kind: "sales" | "purchase", from: string, to: string) => apiUrl(`/accounts/registers/${kind}?from=${from}&to=${to}&format=xlsx`),
  createContra: async (body: { from: string; to: string; amount: number; date?: string; mode?: string; reference?: string; narration?: string; requestId?: string }) =>
    (await httpClient.post<{ success: boolean; contra: Contra }>("/accounts/contras", body)).contra,
  cancelContra: async (id: string, reason: string) => (await httpClient.post<{ success: boolean; contra: Contra }>(`/accounts/contras/${id}/cancel`, { reason })).contra,

  // ── Opening balances ──
  openingBalances: (q: Record<string, unknown>) =>
    httpClient.get<Page<"rows", OpeningBalance> & { totals: Record<"customer" | "supplier", { due: number; advance: number }> }>("/accounts/opening-balances", clean(q)),
  createOpening: async (body: { partyType: "customer" | "supplier"; party: string; kind: "due" | "advance"; refNo?: string; date: string; dueDate?: string; amount: number; notes?: string; requestId?: string }) =>
    (await httpClient.post<{ success: boolean; row: OpeningBalance }>("/accounts/opening-balances", body)).row,
  cancelOpening: async (id: string, reason: string) => (await httpClient.post<{ success: boolean; row: OpeningBalance }>(`/accounts/opening-balances/${id}/cancel`, { reason })).row,
  async importOpening(file: File): Promise<{ rows: OpeningImportRow[]; ok: number; problems: number; file: string }> {
    const fd = new FormData();
    fd.append("file", file);
    return uploadForm("/accounts/opening-balances/import", fd, "Could not read the file");
  },
  // A balance is known by what it is (whose, which side, its date, reference and amount): one already
  // in the books is answered with its number and `replay`, and is not posted again.
  bulkOpening: (rows: Array<Partial<OpeningImportRow> & { requestId?: string }>) =>
    httpClient.post<{ success: boolean; results: Array<{ index: number; ok: boolean; docNo?: string; error?: string; replay?: boolean }>; posted: number; failed: number }>("/accounts/opening-balances/bulk", { rows }),
  openingTemplateUrl: apiUrl("/accounts/opening-balances/template.xlsx"),
  // Set once, from the dashboard: who is left, the day they are as on.
  openingOnboarding: (q: { partyType?: string; search?: string; limit?: number }) =>
    httpClient.get<{ success: boolean } & OpeningOnboarding>("/accounts/opening-onboarding", clean(q)),
  setOpeningAsOn: (asOn: string) => httpClient.put<{ success: boolean; asOn: string }>("/accounts/opening-onboarding", { asOn }),
  markOpeningNone: (b: { partyType: "customer" | "supplier"; party: string }) => httpClient.post<{ success: boolean }>("/accounts/opening-onboarding/none", b),
  closeOpeningOnboarding: () => httpClient.post<{ success: boolean; left: number }>("/accounts/opening-onboarding/close", {}),

  // ── Settings and the lock ──
  accountsSettings: async () => (await httpClient.get<{ success: boolean; settings: AccountsSettings }>("/accounts/settings")).settings,
  saveAccountsSettings: async (body: Partial<Pick<AccountsSettings, "tally" | "bills" | "gst" | "journals" | "tds" | "costCentres" | "receivables" | "lut">>) =>
    (await httpClient.put<{ success: boolean; settings: AccountsSettings }>("/accounts/settings", body)).settings,
  /** The collections settings: reply acknowledgements and scheduled reminders. */
  saveCollectionSettings: async (collections: Record<string, unknown>) =>
    (await httpClient.put<{ success: boolean }>("/accounts/settings", { collections })),
  lockBooks: async (lockDate: string | null, reason?: string) =>
    (await httpClient.post<{ success: boolean; settings: AccountsSettings }>("/accounts/lock", { lockDate, reason })).settings,
  /** Every time the books were closed, moved or reopened, and every entry an admin let through the lock, newest first. */
  lockHistory: async () => (await httpClient.get<{ success: boolean; events: LockEvent[] }>("/accounts/lock/history")).events,

  // ── Documents for the other side ──
  notePdfUrl: (id: string) => apiUrl(`/accounts/notes/${id}/pdf`),
  paymentPdfUrl: (id: string) => apiUrl(`/accounts/payments/${id}/pdf`),
  statementPdfUrl: (partyType: "customer" | "supplier", party: string, range: { from?: string; to?: string } = {}, detailed = false) =>
    apiUrl(`/accounts/statement/pdf?${new URLSearchParams(clean({ partyType, party, ...range, detailed: detailed ? "1" : undefined }) as Record<string, string>).toString()}`),
  statementXlsxUrl: (partyType: "customer" | "supplier", party: string, range: { from?: string; to?: string } = {}) =>
    apiUrl(`/accounts/statement/xlsx?${new URLSearchParams(clean({ partyType, party, ...range }) as Record<string, string>).toString()}`),
  ledgerSummary: (partyType: "customer" | "supplier", range: { from?: string; to?: string } = {}) =>
    httpClient.get<GroupSummary & { success: boolean }>("/accounts/ledger/summary", clean({ partyType, ...range })),
  ledgerSummaryXlsxUrl: (partyType: "customer" | "supplier", range: { from?: string; to?: string } = {}) =>
    apiUrl(`/accounts/ledger/summary?${new URLSearchParams(clean({ partyType, ...range, format: "xlsx" }) as Record<string, string>).toString()}`),
  noteEinvoiceJson: (id: string) => httpClient.getBlob(`/accounts/notes/${id}/einvoice.json`),
  registerNoteIrn: (id: string) => httpClient.post<{ success: boolean; note: AccountNote }>(`/accounts/notes/${id}/register-irn`, {}),
  pasteNoteIrn: (id: string, body: { irn: string; ackNo?: string; ackDate?: string; signedQr?: string }) =>
    httpClient.post<{ success: boolean; note: AccountNote }>(`/accounts/notes/${id}/irn`, body),
  shareDraft: (body: { kind: "payment" | "note" | "statement"; id?: string; partyType?: "customer" | "supplier"; party?: string; from?: string; to?: string }) =>
    httpClient.post<{ success: boolean; to: string; message: string }>("/accounts/share/draft", body, { timeoutMs: MODEL_TIMEOUT_MS }),

  // ── Inbox and insights ──
  inbox: () => httpClient.get<Inbox & { success: boolean }>("/accounts/inbox"),
  checkBill: async (body: Record<string, unknown>) => (await httpClient.post<{ success: boolean; flags: Flag[] }>("/accounts/bills/check", body)).flags,
  /** Before money goes out: a changed or shared bank account, a payment twice, and the like. */
  checkPayment: async (body: Record<string, unknown>) => (await httpClient.post<{ success: boolean; flags: Flag[] }>("/accounts/payments/check", body)).flags,
  checkExpense: async (body: Record<string, unknown>) => (await httpClient.post<{ success: boolean; flags: Flag[] }>("/accounts/expenses/check", body)).flags,
  suggestCategory: async (q: { supplier?: string; payee?: string; description?: string }) =>
    (await httpClient.get<{ success: boolean; suggestion: { category: string; name: string; confidence: number; reason: string } | null }>("/accounts/suggest/category", clean(q))).suggestion,
  forecast: (weeks = 6) => httpClient.get<Forecast & { success: boolean }>("/accounts/forecast", { weeks }),
  closeChecklist: (month?: string) => httpClient.get<CloseChecklist & { success: boolean }>("/accounts/close", clean({ month })),
  aiStats: () => httpClient.get<{ success: boolean; days: number; surfaces: AiSurfaceStats[]; weakFields: Array<{ surface: string; field: string; suggestions: number }> }>("/accounts/ai/stats"),
  recurring: async () => (await httpClient.get<{ success: boolean; rows: RecurringExpense[] }>("/accounts/recurring")).rows,
  saveRecurring: async (id: string | undefined, body: Record<string, unknown>) =>
    (await (id ? httpClient.put<{ success: boolean; row: RecurringExpense }>(`/accounts/recurring/${id}`, body) : httpClient.post<{ success: boolean; row: RecurringExpense }>("/accounts/recurring", body))).row,
  runRecurring: () => httpClient.post<{ success: boolean; drafted: string[] }>("/accounts/recurring/run", {}),
  exportUrl: (what: "bills" | "expenses" | "vouchers" | "notes" | "receivables" | "payables", range: { from?: string; to?: string } = {}) =>
    apiUrl(`/accounts/export/${what}${Object.keys(clean(range)).length ? `?${new URLSearchParams(clean(range) as Record<string, string>).toString()}` : ""}`),

  attachmentUrl: (kind: "bills" | "expenses" | "notes" | "payments", id: string, aid: string) => apiUrl(`/accounts/${kind}/${id}/attachments/${aid}`),
};
