import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Check, X, Banknote } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
import type { Expense, ExpenseStatus, LineInput } from "./types";

/** Which account the money goes from, for paying an expense. */
export function PayDialog({ title, amount, onClose, onConfirm, loading }: { title: string; amount: number; onClose: () => void; onConfirm: (body: { account: string; reference?: string }) => void; loading?: boolean }) {
  const { data: accounts } = useBankAccounts();
  const [account, setAccount] = useState("");
  const [reference, setReference] = useState("");
  const list = (accounts ?? []).filter((a) => a.active !== false);
  const chosen = account || list.find((a) => a.isDefault)?._id || list[0]?._id || "";
  return (
    <Modal open onClose={onClose} title={title} width="max-w-md">
      <div className="space-y-3">
        <p className="text-sm">₹{money(amount)} goes out from:</p>
        <Select label="Account" value={chosen} onChange={(e) => setAccount(e.target.value)} options={list.map((a) => ({ value: a._id, label: `${a.name} (₹${money(a.balance)})` }))} />
        <Input label="Reference (UTR, cheque, UPI ref)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm({ account: chosen, reference: reference.trim() || undefined })} disabled={!chosen} loading={loading}>Pay</Button>
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data, isLoading } = useExpenses({ page, status, search });
  const { approveExpense, rejectExpense, payExpense } = useAccountsMutations();
  const [reject, setReject] = useState<Expense | null>(null);
  const [pay, setPay] = useState<Expense | null>(null);
  const canApprove = user?.role === "admin" || user?.role === "accounts";

  const columns: Column<Expense>[] = [
    { key: "no", header: "Expense", render: (e) => <span className="font-medium">{e.expenseNo}</span> },
    { key: "date", header: "Date", render: (e) => formatDate(e.date) },
    { key: "cat", header: "Head", render: (e) => e.categoryName },
    { key: "desc", header: "Description", render: (e) => <span>{e.description}{e.payeeName ? <span className="block text-xs text-ink-400">{e.payeeName}</span> : null}</span>, cellClassName: "whitespace-normal" },
    { key: "amount", header: "Amount (₹)", align: "right", render: (e) => money(e.totals?.grand) },
    { key: "by", header: "Entered by", render: (e) => e.submittedByName || "—" },
    { key: "status", header: "Status", render: (e) => <StatusChip tone={expenseTone[e.status]}>{expenseLabel[e.status]}</StatusChip> },
    {
      key: "actions", header: "", render: (e) => (
        <span className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
          {e.status === "pending" && canApprove && (
            <>
              <Button size="sm" variant="secondary" aria-label={`Approve ${e.expenseNo}`} onClick={() => approveExpense.mutate({ id: e._id }, { onSuccess: () => toast(`${e.expenseNo} approved`, "success"), onError: (err) => toast(err instanceof ApiError ? err.message : "Could not approve", "error") })}><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" aria-label={`Reject ${e.expenseNo}`} onClick={() => setReject(e)}><X className="h-4 w-4" /></Button>
            </>
          )}
          {e.status === "approved" && <Button size="sm" variant="secondary" aria-label={`Pay ${e.expenseNo}`} onClick={() => setPay(e)}><Banknote className="h-4 w-4" /> Pay</Button>}
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
        <Button className="ml-auto" onClick={() => setParams({ new: "expense" })}><Plus className="h-4 w-4" /> New expense</Button>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.expenses ?? []} rowKey={(e) => e._id} onRowClick={(e) => navigate(`/accounts/expenses/${e._id}`)} loading={isLoading}
          emptyTitle="No expenses yet" emptyDescription="Transport, electricity, rent, repairs — with the receipt attached." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      <FormScreen open={params.get("new") === "expense"} onClose={() => setParams({})} title="New expense" width="max-w-4xl">
        <ExpenseForm onDone={() => setParams({})} onCancel={() => setParams({})} />
      </FormScreen>
      <ReasonDialog open={!!reject} onClose={() => setReject(null)} title={`Reject ${reject?.expenseNo ?? ""}?`} description="The person who entered it sees the reason." confirmLabel="Reject" minLength={8} loading={rejectExpense.isPending}
        onConfirm={(reason) => reject && rejectExpense.mutate({ id: reject._id, reason }, { onSuccess: () => { setReject(null); toast("Expense rejected", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not reject", "error") })} />
      {pay && (
        <PayDialog title={`Pay ${pay.expenseNo}`} amount={pay.totals.grand - pay.paidAmount} loading={payExpense.isPending} onClose={() => setPay(null)}
          onConfirm={(body) => payExpense.mutate({ id: pay._id, body }, { onSuccess: (r) => { setPay(null); toast(`Paid — voucher ${r.voucher.voucherNo}`, "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not pay", "error") })} />
      )}
    </>
  );
}

/**
 * An expense: a head, what for, who was paid and how much. One amount
 * with its GST, or itemised lines. Paid on the spot from an account, or
 * left to be paid after approval.
 */
export function ExpenseForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const { createExpense } = useAccountsMutations();
  const { data: categories } = useCategories();
  const { data: accounts } = useBankAccounts();
  const { data: settings } = useDocumentSettings();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [supplier, setSupplier] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [payeeGstin, setPayeeGstin] = useState("");
  const [refNo, setRefNo] = useState("");
  const [itemised, setItemised] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [gstPercent, setGstPercent] = useState<number | "">(0);
  const [lines, setLines] = useState<LineInput[]>([blankLine(0)]);
  const [payNow, setPayNow] = useState(false);
  const [account, setAccount] = useState("");
  const [notes, setNotes] = useState("");

  const cat = useMemo(() => (categories ?? []).find((c) => c._id === category), [categories, category]);
  const sellerState = settings?.invoice?.stateCode || stateCodeFromGstin(settings?.gstin);
  const supplyType: SupplyType = payeeGstin && sellerState && stateCodeFromGstin(payeeGstin) !== sellerState ? "inter" : "intra";
  const effectiveLines: LineInput[] = itemised ? lines : [{ description: description || "Expense", quantity: 1, rate: amount, gstPercent }];
  const priced = priceInputs(effectiveLines, supplyType);
  const needsApproval = !!cat && (cat.approvalAbove === 0 || priced.totals.grand > (cat.approvalAbove ?? 0));
  const accountList = (accounts ?? []).filter((a) => a.active !== false);
  const chosenAccount = account || accountList.find((a) => a.isDefault)?._id || accountList[0]?._id || "";
  const ready = category && description.trim() && (itemised ? lines.every((l) => l.description.trim() && l.rate !== "") : Number(amount) > 0);

  const submit = () =>
    createExpense.mutate(
      {
        category, description: description.trim(), date, supplier: supplier || undefined, payeeName: payeeName.trim() || undefined, payeeGstin: payeeGstin.trim() || undefined, refNo: refNo.trim() || undefined,
        ...(itemised ? { lines } : { amount: Number(amount), gstPercent: Number(gstPercent) || 0 }),
        payNow: payNow && !needsApproval && chosenAccount ? { account: chosenAccount } : undefined, notes: notes.trim() || undefined,
      },
      {
        onSuccess: (r) => { toast(r.voucher ? `${r.expense.expenseNo} paid — voucher ${r.voucher.voucherNo}` : r.expense.status === "pending" ? `${r.expense.expenseNo} sent for approval` : `${r.expense.expenseNo} recorded`, "success"); onDone(); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not record the expense", "error"),
      }
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Head *" value={category} onChange={(e) => { setCategory(e.target.value); const c = (categories ?? []).find((x) => x._id === e.target.value); if (c && !itemised) setGstPercent(c.itcEligible ? 18 : 0); }}
          options={(categories ?? []).filter((c) => c.active !== false).map((c) => ({ value: c._id, label: c.name }))} placeholder="Pick a head" />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="What for *" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lorry to Tiruppur, 6 boxes" />
        <Input label="Payee's bill / receipt no." value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        <PartyPicker partyType="supplier" label="Supplier on file (optional)" value={supplier} onChange={(id, name) => { setSupplier(id); if (name) setPayeeName(name); }} />
        <Input label="Paid to" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Name on the receipt" />
        <Input label="Payee GSTIN (for input credit)" value={payeeGstin} onChange={(e) => setPayeeGstin(e.target.value.toUpperCase())} />
      </div>

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
          {payNow && <Select label="From account" value={chosenAccount} onChange={(e) => setAccount(e.target.value)} options={accountList.map((a) => ({ value: a._id, label: `${a.name} (₹${money(a.balance)})` }))} />}
        </div>
      )}
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready} loading={createExpense.isPending}>{needsApproval ? "Send for approval" : payNow ? "Record and pay" : "Record expense"}</Button>
      </div>
    </div>
  );
}
