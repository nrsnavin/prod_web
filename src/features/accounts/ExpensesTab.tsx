import { FlagList, riskFlags, useFlags } from "./Flags";
import { quickCreate } from "@/features/common/quickCreateStore";
import { accountsService } from "./api";
import { CostCentreField, costCentreBody } from "./CostCentreField";
import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Plus, Check, X, Banknote, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormScreen } from "@/components/ui/FormScreen";
import { Modal } from "@/components/ui/Modal";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAuth } from "@/core/auth/useAuth";
import { useDocumentSettings } from "@/features/settings/hooks";
import { stateCodeFromGstin } from "@/features/invoices/gst";
import type { SupplyType } from "@/features/invoices/types";
import { useAccountsMutations, useBankAccounts, useCategories, useExpenses } from "./hooks";
import { LinesEditor, PartyPicker, blankLine, expenseLabel, expenseTone, money, priceInputs, today } from "./shared";
import type { Expense, ExpenseStatus, Flag, LineInput, CostCentreInput } from "./types";
import type { ScanDraft } from "./ScanBill";

export type PayBody = { account: string; reference?: string; confirmRisk?: boolean; riskNote?: string };

/**
 * Which account the money goes from, for paying an expense.
 *
 * Paying an expense goes through the same checks as any payment. When
 * the server stops it — the supplier's bank account changed lately, or
 * is another supplier's too — the caller hands the checks back through
 * `onRisk`, and the dialog asks how it was confirmed before paying.
 */
export function PayDialog({ title, amount, onClose, onConfirm, loading }: { title: string; amount: number; onClose: () => void; onConfirm: (body: PayBody, onRisk: (flags: Flag[]) => void) => void; loading?: boolean }) {
  const { data: accounts } = useBankAccounts();
  const [account, setAccount] = useState("");
  const [reference, setReference] = useState("");
  const [risk, setRisk] = useState<Flag[] | null>(null);
  const [riskNote, setRiskNote] = useState("");
  const list = (accounts ?? []).filter((a) => a.active !== false);
  const chosen = account || list.find((a) => a.isDefault)?._id || list[0]?._id || "";
  const pay = (confirmed: boolean) => onConfirm({ account: chosen, reference: reference.trim() || undefined, ...(confirmed ? { confirmRisk: true, riskNote: riskNote.trim() } : {}) }, setRisk);
  return (
    <Modal open onClose={onClose} title={title} width="max-w-md">
      <div className="space-y-3">
        <p className="text-sm">₹{money(amount)} goes out from:</p>
        <Select label="Account" value={chosen} onChange={(e) => setAccount(e.target.value)} options={list.map((a) => ({ value: a._id, label: `${a.name} (₹${money(a.balance)})` }))} />
        <Input label="Reference (UTR, cheque, UPI ref)" value={reference} onChange={(e) => setReference(e.target.value)} />
        {risk && (
          <div role="alert" aria-label="Payment stopped" className="space-y-2 rounded-lg border border-status-danger/40 bg-status-dangerBg p-3 text-sm">
            <p className="font-semibold text-status-danger">Stopped before the money goes</p>
            <FlagList flags={risk} />
            <Input label="How you confirmed it *" value={riskNote} onChange={(e) => setRiskNote(e.target.value)} placeholder="e.g. Called Mr. Raju on the number on file; he confirmed the new account" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{risk ? "Don't pay" : "Cancel"}</Button>
          {risk
            ? <Button variant="danger" onClick={() => pay(true)} disabled={!chosen || riskNote.trim().length < 8} loading={loading}>Confirmed — pay</Button>
            : <Button onClick={() => pay(false)} disabled={!chosen} loading={loading}>Pay</Button>}
        </div>
      </div>
    </Modal>
  );
}

export function ExpensesTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ExpenseStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const state = location.state as { reenter?: ScanDraft; category?: string; title?: string } | null;
  const [reenter, setReenter] = useState<ScanDraft | undefined>(state?.reenter);
  const reenterCategory = state?.category;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data, isLoading } = useExpenses({ page, status, search });
  const { approveExpense, rejectExpense, payExpense } = useAccountsMutations();
  const [reject, setReject] = useState<Expense | null>(null);
  const [pay, setPay] = useState<Expense | null>(null);
  const canApprove = user?.role === "admin" || user?.role === "accounts";

  const columns: Column<Expense>[] = [
    // The date under the number: one column fewer keeps the actions on screen.
    { key: "no", header: "Expense", render: (e) => <span><span className="font-medium">{e.expenseNo}</span><span className="block text-xs text-ink-400">{formatDate(e.date)}</span></span> },
    { key: "cat", header: "Head", render: (e) => e.categoryName, cellClassName: "whitespace-normal" },
    { key: "desc", header: "Description", render: (e) => <span>{e.description}{e.payeeName ? <span className="block text-xs text-ink-400">{e.payeeName}</span> : null}</span>, cellClassName: "whitespace-normal" },
    { key: "amount", header: "Amount (₹)", align: "right", render: (e) => money(e.totals?.grand) },
    { key: "by", header: "Entered by", render: (e) => e.submittedByName || "—" },
    { key: "status", header: "Status", render: (e) => <StatusChip tone={expenseTone[e.status]}>{expenseLabel[e.status]}</StatusChip> },
    {
      key: "actions", header: "", render: (e) => (
        <span className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
          {e.status === "pending" && canApprove && (
            <>
              {/* Approving posts it to the payee's account, so it asks in place, with the amount. */}
              <InlineConfirm variant="secondary" aria-label={`Approve ${e.expenseNo}`} title="Approve"
                question={`Approve ₹${money(e.totals?.grand)}?`} confirmLabel={`Approve ${e.expenseNo}`}
                loading={approveExpense.isPending && approveExpense.variables?.id === e._id}
                onConfirm={() => approveExpense.mutate({ id: e._id }, { onSuccess: () => toast(`${e.expenseNo} approved`, "success"), onError: (err) => toast(err instanceof ApiError ? err.message : "Could not approve", "error") })}>
                <Check className="h-4 w-4" />
              </InlineConfirm>
              <Button size="sm" variant="ghost" aria-label={`Reject ${e.expenseNo}`} onClick={() => setReject(e)}><X className="h-4 w-4" /></Button>
            </>
          )}
          {e.status === "approved" && <Button size="sm" variant="secondary" aria-label={`Pay ${e.expenseNo}`} title="Pay" onClick={() => setPay(e)}><Banknote className="h-4 w-4" /><span className="hidden 2xl:inline"> Pay</span></Button>}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Expense no., description, payee…" className="w-full max-w-xs" />
        <FilterChips
          options={[{ value: "all", label: "All" }, { value: "pending", label: `To approve${data?.pendingCount ? ` (${data.pendingCount})` : ""}` }, { value: "approved", label: "To pay" }, { value: "paid", label: "Paid" }, { value: "rejected", label: "Rejected" }]}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
        />
        <a href={accountsService.exportUrl("expenses")} className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-brand-600 hover:bg-brand-50"><Download className="h-4 w-4" /> Excel</a>
        <Button onClick={() => setParams({ new: "expense" })}><Plus className="h-4 w-4" /> New expense</Button>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.expenses ?? []} rowKey={(e) => e._id} onRowClick={(e) => navigate(`/accounts/expenses/${e._id}`)} loading={isLoading}
          emptyTitle="No expenses yet" emptyDescription="Transport, electricity, rent, repairs — with the receipt attached." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      <FormScreen open={params.get("new") === "expense" || !!reenter} onClose={() => { setReenter(undefined); setParams({}); }} title={reenter ? (state?.title ?? "Re-enter the expense") : "New expense"} width="max-w-4xl">
        {(params.get("new") === "expense" || reenter) && <ExpenseForm key={reenter ? "reenter" : "new"} initialDraft={reenter} initialCategory={reenterCategory} onDone={() => { setReenter(undefined); setParams({}); }} onCancel={() => { setReenter(undefined); setParams({}); }} />}
      </FormScreen>
      <ReasonDialog open={!!reject} onClose={() => setReject(null)} title={`Reject ${reject?.expenseNo ?? ""}?`} description="The person who entered it sees the reason." confirmLabel="Reject" minLength={8} loading={rejectExpense.isPending}
        onConfirm={(reason) => reject && rejectExpense.mutate({ id: reject._id, reason }, { onSuccess: () => { setReject(null); toast("Expense rejected", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not reject", "error") })} />
      {pay && (
        <PayDialog title={`Pay ${pay.expenseNo}`} amount={pay.totals.grand - pay.paidAmount} loading={payExpense.isPending} onClose={() => setPay(null)}
          onConfirm={(body, onRisk) => payExpense.mutate({ id: pay._id, body }, {
            onSuccess: (r) => { setPay(null); toast(`Paid — voucher ${r.voucher.voucherNo}`, "success"); },
            onError: (e) => { const flags = riskFlags(e); if (flags) return onRisk(flags); toast(e instanceof ApiError ? e.message : "Could not pay", "error"); },
          })} />
      )}
    </>
  );
}

/**
 * An expense: a head, what for, who was paid and how much. One amount
 * with its GST, or itemised lines. Paid on the spot from an account, or
 * left to be paid after approval.
 */
export function ExpenseForm({ onDone, onCancel, initialDraft, initialCategory }: { onDone: () => void; onCancel: () => void; initialDraft?: ScanDraft; initialCategory?: string }) {
  const { toast } = useToast();
  const { createExpense } = useAccountsMutations();
  const { data: categories } = useCategories();
  const { data: accounts } = useBankAccounts();
  const { data: settings } = useDocumentSettings();
  const scanned = initialDraft?.lines ?? [];
  const [category, setCategory] = useState(initialCategory ?? "");
  const [description, setDescription] = useState(scanned.length === 1 ? scanned[0].description : "");
  const [date, setDate] = useState(initialDraft?.billDate ?? today());
  const [supplier, setSupplier] = useState(initialDraft?.supplier?._id ?? "");
  const [payeeName, setPayeeName] = useState(initialDraft?.supplier?.name ?? initialDraft?.supplierName ?? "");
  const [payeeGstin, setPayeeGstin] = useState(initialDraft?.supplierGstin ?? "");
  const [refNo, setRefNo] = useState(initialDraft?.billNo ?? "");
  const [itemised, setItemised] = useState(scanned.length > 1);
  const [amount, setAmount] = useState<number | "">(scanned.length === 1 ? Number(scanned[0].rate) * (Number(scanned[0].quantity) || 1) || "" : "");
  const [gstPercent, setGstPercent] = useState<number | "">(scanned.length === 1 ? scanned[0].gstPercent : 0);
  const [lines, setLines] = useState<LineInput[]>(scanned.length > 1 ? scanned : [blankLine(0)]);
  const [payNow, setPayNow] = useState(false);
  const [account, setAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [costCentre, setCostCentre] = useState<CostCentreInput | undefined>(undefined);

  const cat = useMemo(() => (categories ?? []).find((c) => c._id === category), [categories, category]);
  const sellerState = settings?.invoice?.stateCode || stateCodeFromGstin(settings?.gstin);
  const supplyType: SupplyType = payeeGstin && sellerState && stateCodeFromGstin(payeeGstin) !== sellerState ? "inter" : "intra";
  const effectiveLines: LineInput[] = itemised ? lines : [{ description: description || "Expense", quantity: 1, rate: amount, gstPercent }];
  const priced = priceInputs(effectiveLines, supplyType);
  const needsApproval = !!cat && (cat.approvalAbove === 0 || priced.totals.grand > (cat.approvalAbove ?? 0));
  const accountList = (accounts ?? []).filter((a) => a.active !== false);
  const chosenAccount = account || accountList.find((a) => a.isDefault)?._id || accountList[0]?._id || "";
  const ready = category && description.trim() && (itemised ? lines.every((l) => l.description.trim() && l.rate !== "") : Number(amount) > 0);
  const flags = useFlags("expense", category || supplier ? { category, supplier: supplier || undefined, date, amount: priced.totals.grand, scannedGstin: initialDraft?.supplierGstin || undefined } : null);
  // The head this payee's expenses usually go under, until one is picked.
  const [suggestion, setSuggestion] = useState<{ category: string; name: string; reason: string } | null>(null);
  useEffect(() => {
    if (category || (!supplier && payeeName.trim().length < 3 && description.trim().length < 4)) { setSuggestion(null); return; }
    let live = true;
    const t = setTimeout(() => {
      accountsService.suggestCategory({ supplier: supplier || undefined, payee: payeeName.trim() || undefined, description: description.trim() || undefined })
        .then((s) => { if (live) setSuggestion(s); }).catch(() => {});
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [category, supplier, payeeName, description]);

  const submit = () =>
    createExpense.mutate(
      {
        category, description: description.trim(), date, supplier: supplier || undefined, payeeName: payeeName.trim() || undefined, payeeGstin: payeeGstin.trim() || undefined, refNo: refNo.trim() || undefined,
        ...(itemised ? { lines } : { amount: Number(amount), gstPercent: Number(gstPercent) || 0 }),
        payNow: payNow && !needsApproval && chosenAccount ? { account: chosenAccount } : undefined, notes: notes.trim() || undefined,
        source: initialDraft?.aiSuggestion ? "scan" : undefined, aiSuggestion: initialDraft?.aiSuggestion ?? undefined,
        costCentre: costCentreBody(costCentre),
      },
      {
        onSuccess: (r) => { toast(r.voucher ? `${r.expense.expenseNo} paid — voucher ${r.voucher.voucherNo}` : r.expense.status === "pending" ? `${r.expense.expenseNo} sent for approval` : `${r.expense.expenseNo} recorded`, "success"); onDone(); },
        // Paying on the spot goes through the payment checks. Stopped by one, the expense is not recorded either:
        // record it without paying, and pay it from the list, which asks how the payment was confirmed.
        onError: (e) => toast(riskFlags(e) ? `${(e as ApiError).message}. Record it without "Already paid", then pay it from the list.` : e instanceof ApiError ? e.message : "Could not record the expense", "error"),
      }
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Head *" value={category} onChange={(e) => { setCategory(e.target.value); const c = (categories ?? []).find((x) => x._id === e.target.value); if (c && !itemised) setGstPercent(c.itcEligible ? 18 : 0); }}
          options={(categories ?? []).filter((c) => c.active !== false).map((c) => ({ value: c._id, label: c.name }))} placeholder="Pick a head" onCreate={() => void quickCreate("expenseHead").then((o) => o && setCategory(o.value))} createLabel="expense head" />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="What for *" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lorry to Tiruppur, 6 boxes" />
        <Input label="Payee's bill / receipt no." value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        <PartyPicker partyType="supplier" label="Supplier on file (optional)" value={supplier} onChange={(id, name) => { setSupplier(id); if (name) setPayeeName(name); }} />
        <Input label="Paid to" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Name on the receipt" />
        <Input label="Payee GSTIN (for input credit)" value={payeeGstin} onChange={(e) => setPayeeGstin(e.target.value.toUpperCase())} />
        <CostCentreField value={costCentre} onChange={setCostCentre} />
      </div>

      {suggestion && !category && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
          <span>Suggested head: <span className="font-semibold">{suggestion.name}</span> <span className="text-ink-400">— {suggestion.reason}</span></span>
          <Button size="sm" variant="secondary" onClick={() => { setCategory(suggestion.category); const c = (categories ?? []).find((x) => x._id === suggestion.category); if (c && !itemised) setGstPercent(c.itcEligible ? 18 : 0); }}>Use it</Button>
        </p>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemised} onChange={(e) => setItemised(e.target.checked)} /> Itemise the bill</label>
      {itemised ? (
        <LinesEditor lines={lines} onChange={setLines} supplyType={supplyType} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Amount before GST *" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
          <Input label="GST %" type="number" step="0.01" min={0} max={100} value={gstPercent} onChange={(e) => setGstPercent(e.target.value === "" ? "" : Number(e.target.value))} />
          <div className="self-end text-sm" aria-label="Expense total">
            <span className="text-ink-500">Total </span><span className="font-semibold tabular-nums">₹{money(priced.totals.grand)}</span>
            {priced.totals.tax > 0 && <span className="text-ink-400"> (tax ₹{money(priced.totals.tax)}{cat?.itcEligible ? ", claimable" : ", not claimable"})</span>}
          </div>
        </div>
      )}

      {cat && (
        <p className="text-sm text-ink-500">
          {needsApproval ? `Needs approval${cat.approvalAbove ? ` (above ₹${money(cat.approvalAbove)} on this head)` : " on this head"}.` : "No approval needed at this amount."}
        </p>
      )}
      {!needsApproval && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} /> Already paid — record the payment now</label>
          {payNow && <Select label="From account" value={chosenAccount} onChange={(e) => setAccount(e.target.value)} onCreate={() => void quickCreate("bankAccount").then((o) => o && setAccount(o.value))} createLabel="account" options={accountList.map((a) => ({ value: a._id, label: `${a.name} (₹${money(a.balance)})` }))} />}
        </div>
      )}
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <FlagList flags={flags} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready} loading={createExpense.isPending}>{needsApproval ? "Send for approval" : payNow ? "Record and pay" : "Record expense"}</Button>
      </div>
    </div>
  );
}
