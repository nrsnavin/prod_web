import { httpClient } from "@/core/http/httpClient";
import type {
  CollectionEntry, ScanResult, StatementPostRow, StatementResult,
  AccountNote, BankAccount, BillCreateBody, BillPoInfo, CashbookReport, DaybookReport, Expense, ExpenseCategory, ExpenseCreateBody,
  ExpenseReport, GstReport, NoteCreateBody, OpenDoc, OutstandingResult, Overview, Payment, PaymentCreateBody, Statement, SupplierBill, TdsReport,
  AccountsSettings, Contra, Credit, OpeningBalance, OpeningImportRow,
  Reconciliation, StoredStatement, StoredStatementLine, TallyBatch, TallyPreview,
} from "./types";

type Page<K extends string, T> = { success: boolean; total: number; page: number; pages: number } & Record<K, T[]>;

const clean = (q: Record<string, unknown>) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== "" && v !== "all"));

export const accountsService = {
  overview: () => httpClient.get<Overview & { success: boolean }>("/accounts/overview"),

  // ── Masters ──
  bankAccounts: async () => (await httpClient.get<{ success: boolean; accounts: BankAccount[] }>("/accounts/bank-accounts")).accounts,
  createBankAccount: async (body: Partial<BankAccount>) => (await httpClient.post<{ success: boolean; account: BankAccount }>("/accounts/bank-accounts", body)).account,
  updateBankAccount: async (id: string, body: Partial<BankAccount>) => (await httpClient.put<{ success: boolean; account: BankAccount }>(`/accounts/bank-accounts/${id}`, body)).account,
  categories: async () => (await httpClient.get<{ success: boolean; categories: ExpenseCategory[] }>("/accounts/categories")).categories,
  createCategory: async (body: Partial<ExpenseCategory>) => (await httpClient.post<{ success: boolean; category: ExpenseCategory }>("/accounts/categories", body)).category,
  updateCategory: async (id: string, body: Partial<ExpenseCategory>) => (await httpClient.put<{ success: boolean; category: ExpenseCategory }>(`/accounts/categories/${id}`, body)).category,

  // ── Bills ──
  bills: (q: Record<string, unknown>) => httpClient.get<Page<"bills", SupplierBill>>("/accounts/bills", clean(q)),
  bill: async (id: string) => httpClient.get<{ success: boolean; bill: SupplierBill; payments: Array<Payment & Partial<{ amount: number; tds: number }>>; notes: AccountNote[] }>(`/accounts/bills/${id}`),
  billPoInfo: (poId: string) => httpClient.get<BillPoInfo & { success: boolean }>("/accounts/bills/po-info", { id: poId }),
  createBill: async (body: BillCreateBody) => (await httpClient.post<{ success: boolean; bill: SupplierBill }>("/accounts/bills", body)).bill,
  cancelBill: async (id: string, reason: string) => (await httpClient.post<{ success: boolean; bill: SupplierBill }>(`/accounts/bills/${id}/cancel`, { reason })).bill,

  // ── Expenses ──
  expenses: (q: Record<string, unknown>) => httpClient.get<Page<"expenses", Expense> & { pendingCount: number }>("/accounts/expenses", clean(q)),
  expense: (id: string) => httpClient.get<{ success: boolean; expense: Expense; payments: Payment[] }>(`/accounts/expenses/${id}`),
  createExpense: (body: ExpenseCreateBody) => httpClient.post<{ success: boolean; expense: Expense; voucher: { _id: string; voucherNo: string } | null }>("/accounts/expenses", body),
  approveExpense: (id: string, body: { note?: string; payNow?: { account: string; mode?: string; reference?: string } } = {}) =>
    httpClient.post<{ success: boolean; expense: Expense; voucher: { _id: string; voucherNo: string } | null }>(`/accounts/expenses/${id}/approve`, body),
  rejectExpense: (id: string, reason: string) => httpClient.post<{ success: boolean; expense: Expense }>(`/accounts/expenses/${id}/reject`, { reason }),
  payExpense: (id: string, body: { account: string; mode?: string; reference?: string; date?: string }) =>
    httpClient.post<{ success: boolean; expense: Expense; voucher: { _id: string; voucherNo: string } }>(`/accounts/expenses/${id}/pay`, body),
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

  // ── AI ──
  async scan(files: File[]): Promise<ScanResult> {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const res = await fetch("/api/v2/accounts/scan", { method: "POST", body: fd, credentials: "include" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || "Could not read the bill");
    return body as ScanResult;
  },
  async uploadStatement(account: string, file: File, useModel = true): Promise<StatementResult> {
    const fd = new FormData();
    fd.append("account", account);
    fd.append("useModel", String(useModel));
    fd.append("file", file);
    const res = await fetch("/api/v2/accounts/bank/statement", { method: "POST", body: fd, credentials: "include" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || "Could not read the statement");
    return body as StatementResult;
  },
  postStatement: (account: string, rows: StatementPostRow[], statement?: string) =>
    httpClient.post<{ success: boolean; results: Array<{ index: number; ok: boolean; voucherNo?: string; _id?: string; error?: string }>; posted: number; failed: number }>("/accounts/bank/statement/post", { account, rows, statement }),
  statements: async (account?: string) => (await httpClient.get<{ success: boolean; statements: StoredStatement[] }>("/accounts/bank/statements", clean({ account }))).statements,
  storedStatement: async (id: string) => (await httpClient.get<{ success: boolean; statement: StoredStatement & { lines: StoredStatementLine[] } }>(`/accounts/bank/statements/${id}`)).statement,
  ignoreLine: (statement: string, index: number, reason: string) => httpClient.post<{ success: boolean }>(`/accounts/bank/statements/${statement}/lines/${index}/ignore`, { reason }),
  linkLine: (statement: string, index: number, voucherType: "Payment" | "Contra", voucher: string) =>
    httpClient.post<{ success: boolean }>(`/accounts/bank/statements/${statement}/lines/${index}/link`, { voucherType, voucher }),
  clearEntry: (body: { voucherType: "Payment" | "Contra"; id: string; account: string; clearedOn: string | null }) => httpClient.post<{ success: boolean }>("/accounts/bank/clear", body),
  reconciliation: (account: string, asOf: string, bankBalance?: number | "") =>
    httpClient.get<Reconciliation & { success: boolean }>("/accounts/bank/reconciliation", clean({ account, asOf, bankBalance })),

  // ── Tally ──
  tallyPreview: (range: { from: string; to: string }) => httpClient.get<TallyPreview & { success: boolean }>("/accounts/tally/preview", range),
  tallyExport: async (body: { from: string; to: string; lock?: boolean; masters?: boolean }) =>
    (await httpClient.post<{ success: boolean; batch: TallyBatch }>("/accounts/tally/export", body)).batch,
  tallyBatches: async () => (await httpClient.get<{ success: boolean; batches: TallyBatch[] }>("/accounts/tally/batches")).batches,
  tallyXml: (id: string) => httpClient.getBlob(`/accounts/tally/batches/${id}/xml`),
  collections: () => httpClient.get<{ success: boolean; rows: CollectionEntry[]; total: number; whatsapp: boolean }>("/accounts/collections"),
  draftReminder: (customer: string, tone: "gentle" | "firm" = "gentle") =>
    httpClient.post<{ success: boolean; message: string; byModel: boolean; to: string; entry: CollectionEntry }>("/accounts/collections/draft", { customer, tone }),
  sendReminder: (to: string, message: string) =>
    httpClient.post<{ success: boolean; sent: boolean; dryRun?: boolean; error?: string; to: string }>("/accounts/collections/send", { to, message }),

  // ── Credits ──
  credits: async (partyType: "customer" | "supplier", party: string) =>
    (await httpClient.get<{ success: boolean; credits: Credit[] }>("/accounts/credits", { partyType, party })).credits,
  applyCredit: (body: { source: { type: Credit["sourceType"]; id: string }; allocations: Array<{ docType: OpenDoc["docType"]; doc: string; amount: number }> }) =>
    httpClient.post<{ success: boolean; applied: number; source: { docNo: string } }>("/accounts/credits/apply", body),

  // ── Contras ──
  contras: (q: Record<string, unknown>) => httpClient.get<Page<"contras", Contra>>("/accounts/contras", clean(q)),
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
    const res = await fetch("/api/v2/accounts/opening-balances/import", { method: "POST", body: fd, credentials: "include" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || "Could not read the file");
    return body;
  },
  bulkOpening: (rows: Array<Partial<OpeningImportRow> & { requestId?: string }>) =>
    httpClient.post<{ success: boolean; results: Array<{ index: number; ok: boolean; docNo?: string; error?: string }>; posted: number; failed: number }>("/accounts/opening-balances/bulk", { rows }),
  openingTemplateUrl: "/api/v2/accounts/opening-balances/template.xlsx",

  // ── Settings and the lock ──
  accountsSettings: async () => (await httpClient.get<{ success: boolean; settings: AccountsSettings }>("/accounts/settings")).settings,
  saveAccountsSettings: async (body: Partial<Pick<AccountsSettings, "tally" | "bills">>) =>
    (await httpClient.put<{ success: boolean; settings: AccountsSettings }>("/accounts/settings", body)).settings,
  lockBooks: async (lockDate: string | null, reason?: string) =>
    (await httpClient.post<{ success: boolean; settings: AccountsSettings }>("/accounts/lock", { lockDate, reason })).settings,

  attachmentUrl: (kind: "bills" | "expenses" | "notes" | "payments", id: string, aid: string) => `/api/v2/accounts/${kind}/${id}/attachments/${aid}`,
};
