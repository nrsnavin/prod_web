import { httpClient } from "@/core/http/httpClient";
import type {
  AccountNote, BankAccount, BillCreateBody, BillPoInfo, CashbookReport, DaybookReport, Expense, ExpenseCategory, ExpenseCreateBody,
  ExpenseReport, GstReport, NoteCreateBody, OpenDoc, OutstandingResult, Overview, Payment, PaymentCreateBody, Statement, SupplierBill, TdsReport,
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
    httpClient.get<{ success: boolean; docs: OpenDoc[]; balance: number }>("/accounts/payments/open-docs", { partyType, party }),
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

  attachmentUrl: (kind: "bills" | "expenses" | "notes" | "payments", id: string, aid: string) => `/api/v2/accounts/${kind}/${id}/attachments/${aid}`,
};
