import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsService } from "./api";
import type { BillCreateBody, ExpenseCreateBody, NoteCreateBody, PaymentCreateBody } from "./types";
import { useRequestId } from "@/core/hooks/useRequestId";

export const ACCOUNTS_KEY = "accounts";

export const useOverview = () => useQuery({ queryKey: [ACCOUNTS_KEY, "overview"], queryFn: accountsService.overview });
export const useBankAccounts = () => useQuery({ queryKey: [ACCOUNTS_KEY, "bank-accounts"], queryFn: accountsService.bankAccounts, staleTime: 60_000 });
export const useCategories = () => useQuery({ queryKey: [ACCOUNTS_KEY, "categories"], queryFn: accountsService.categories, staleTime: 60_000 });

export const useBills = (q: Record<string, unknown>) => useQuery({ queryKey: [ACCOUNTS_KEY, "bills", q], queryFn: () => accountsService.bills(q), placeholderData: (p) => p });
export const useBill = (id?: string) => useQuery({ queryKey: [ACCOUNTS_KEY, "bill", id], queryFn: () => accountsService.bill(id!), enabled: !!id });
export const useBillPoInfo = (poId?: string) => useQuery({ queryKey: [ACCOUNTS_KEY, "po-info", poId], queryFn: () => accountsService.billPoInfo(poId!), enabled: !!poId });

export const useExpenses = (q: Record<string, unknown>) => useQuery({ queryKey: [ACCOUNTS_KEY, "expenses", q], queryFn: () => accountsService.expenses(q), placeholderData: (p) => p });
export const useExpense = (id?: string) => useQuery({ queryKey: [ACCOUNTS_KEY, "expense", id], queryFn: () => accountsService.expense(id!), enabled: !!id });

export const useNotes = (q: Record<string, unknown>) => useQuery({ queryKey: [ACCOUNTS_KEY, "notes", q], queryFn: () => accountsService.notes(q), placeholderData: (p) => p });
export const useNote = (id?: string) => useQuery({ queryKey: [ACCOUNTS_KEY, "note", id], queryFn: () => accountsService.note(id!), enabled: !!id });

export const usePayments = (q: Record<string, unknown>) => useQuery({ queryKey: [ACCOUNTS_KEY, "payments", q], queryFn: () => accountsService.payments(q), placeholderData: (p) => p });
export const usePayment = (id?: string) => useQuery({ queryKey: [ACCOUNTS_KEY, "payment", id], queryFn: () => accountsService.payment(id!), enabled: !!id });
export const useOpenDocs = (partyType?: "customer" | "supplier", party?: string) =>
  useQuery({ queryKey: [ACCOUNTS_KEY, "open-docs", partyType, party], queryFn: () => accountsService.openDocs(partyType!, party!), enabled: !!partyType && !!party });

export const useStatement = (partyType?: "customer" | "supplier", party?: string, range: { from?: string; to?: string } = {}) =>
  useQuery({ queryKey: [ACCOUNTS_KEY, "statement", partyType, party, range], queryFn: () => accountsService.statement(partyType!, party!, range), enabled: !!partyType && !!party });
export const useOutstanding = (type: "receivable" | "payable", party?: string) =>
  useQuery({ queryKey: [ACCOUNTS_KEY, "outstanding", type, party], queryFn: () => accountsService.outstanding(type, party) });

export const useCredits = (partyType?: "customer" | "supplier", party?: string) =>
  useQuery({ queryKey: [ACCOUNTS_KEY, "credits", partyType, party], queryFn: () => accountsService.credits(partyType!, party!), enabled: !!partyType && !!party });
export const useContras = (q: Record<string, unknown>, enabled = true) =>
  useQuery({ queryKey: [ACCOUNTS_KEY, "contras", q], queryFn: () => accountsService.contras(q), placeholderData: (p) => p, enabled });
export const useOpeningBalances = (q: Record<string, unknown>) =>
  useQuery({ queryKey: [ACCOUNTS_KEY, "opening", q], queryFn: () => accountsService.openingBalances(q), placeholderData: (p) => p });
export const useAccountsSettings = () => useQuery({ queryKey: [ACCOUNTS_KEY, "settings"], queryFn: accountsService.accountsSettings, staleTime: 60_000 });

export function useAccountsMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["customer-recent"] });
  };
  const ids = useRequestId();
  const once = <T extends { requestId?: string }>(body: T): T => ({ ...body, requestId: ids.for(body) });
  const done = () => { ids.done(); invalidate(); };
  return {
    createBill: useMutation({ mutationFn: (b: BillCreateBody) => accountsService.createBill(once(b)), onSuccess: done }),
    cancelBill: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => accountsService.cancelBill(id, reason), onSuccess: invalidate }),
    createExpense: useMutation({ mutationFn: (b: ExpenseCreateBody) => accountsService.createExpense(once(b)), onSuccess: done }),
    approveExpense: useMutation({ mutationFn: ({ id, body }: { id: string; body?: Parameters<typeof accountsService.approveExpense>[1] }) => accountsService.approveExpense(id, body), onSuccess: invalidate }),
    rejectExpense: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => accountsService.rejectExpense(id, reason), onSuccess: invalidate }),
    payExpense: useMutation({ mutationFn: ({ id, body }: { id: string; body: Parameters<typeof accountsService.payExpense>[1] }) => accountsService.payExpense(id, body), onSuccess: invalidate }),
    cancelExpense: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => accountsService.cancelExpense(id, reason), onSuccess: invalidate }),
    createNote: useMutation({ mutationFn: (b: NoteCreateBody) => accountsService.createNote(once(b)), onSuccess: done }),
    cancelNote: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => accountsService.cancelNote(id, reason), onSuccess: invalidate }),
    createPayment: useMutation({ mutationFn: (b: PaymentCreateBody) => accountsService.createPayment(once(b)), onSuccess: done }),
    cancelPayment: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => accountsService.cancelPayment(id, reason), onSuccess: invalidate }),
    applyCredit: useMutation({ mutationFn: accountsService.applyCredit, onSuccess: invalidate }),
    createContra: useMutation({ mutationFn: (b: Parameters<typeof accountsService.createContra>[0]) => accountsService.createContra(once(b)), onSuccess: done }),
    cancelContra: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => accountsService.cancelContra(id, reason), onSuccess: invalidate }),
    createOpening: useMutation({ mutationFn: (b: Parameters<typeof accountsService.createOpening>[0]) => accountsService.createOpening(once(b)), onSuccess: done }),
    cancelOpening: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => accountsService.cancelOpening(id, reason), onSuccess: invalidate }),
    bulkOpening: useMutation({ mutationFn: accountsService.bulkOpening, onSuccess: invalidate }),
    saveAccountsSettings: useMutation({ mutationFn: accountsService.saveAccountsSettings, onSuccess: invalidate }),
    lockBooks: useMutation({ mutationFn: ({ lockDate, reason }: { lockDate: string | null; reason?: string }) => accountsService.lockBooks(lockDate, reason), onSuccess: invalidate }),
    saveBankAccount: useMutation({
      mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) => (id ? accountsService.updateBankAccount(id, body) : accountsService.createBankAccount(body)),
      onSuccess: invalidate,
    }),
    saveCategory: useMutation({
      mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) => (id ? accountsService.updateCategory(id, body) : accountsService.createCategory(body)),
      onSuccess: invalidate,
    }),
  };
}
