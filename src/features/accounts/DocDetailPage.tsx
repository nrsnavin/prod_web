import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, XCircle, Check, X, Banknote, Paperclip, Wallet, RotateCcw, FileDown, FileJson, BadgeCheck, ClipboardPaste, MessageCircle } from "lucide-react";
import { IrnDialog } from "@/features/invoices/IrnDialog";
import { ShareDialog } from "./Share";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { FormScreen } from "@/components/ui/FormScreen";
import { TableScroll } from "@/components/ui/TableScroll";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useAuth } from "@/core/auth/useAuth";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useAccountsMutations, useBill, useExpense, useNote, usePayment } from "./hooks";
import { PayDialog } from "./ExpensesTab";
import { VoucherForm } from "./VouchersTab";
import { ApplyCreditDialog } from "./Credits";
import { noteKindLabel } from "./NotesTab";
import { billLabel, billTone, expenseLabel, expenseTone, money, qty } from "./shared";
import type { Attachment, Credit, Fingerprint, TaxLine } from "./types";
import { ADJUSTMENT_LABELS } from "./types";
import { useNavigate } from "react-router-dom";
import type { SupplyType } from "@/features/invoices/types";

type Kind = "bills" | "expenses" | "notes" | "payments";

function Lines({ lines, supplyType }: { lines?: TaxLine[]; supplyType: SupplyType }) {
  if (!lines?.length) return null;
  const inter = supplyType === "inter";
  return (
    <TableScroll>
      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2 text-left font-medium">Description</th><th className="py-2 text-left font-medium">HSN</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Rate</th><th className="py-2 text-right font-medium">Taxable</th><th className="py-2 text-right font-medium">GST</th><th className="py-2 text-right font-medium">{inter ? "IGST" : "CGST + SGST"}</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {lines.map((l, i) => <tr key={i}><td className="py-2">{l.description}</td><td className="py-2">{l.hsn || "—"}</td><td className="py-2 text-right tabular-nums">{qty(l.quantity)} {l.unit}</td><td className="py-2 text-right tabular-nums">{money(l.rate)}</td><td className="py-2 text-right tabular-nums">{money(l.taxable)}</td><td className="py-2 text-right">{l.gstPercent}%</td><td className="py-2 text-right tabular-nums">{money(inter ? l.igst : l.cgst + l.sgst)}</td><td className="py-2 text-right tabular-nums font-medium">{money(l.amount)}</td></tr>)}
        </tbody>
      </table>
    </TableScroll>
  );
}

function History({ rows }: { rows?: Fingerprint[] }) {
  if (!rows?.length) return null;
  return (
    <Card className="mt-4 p-5">
      <h3 className="font-semibold">History</h3>
      <ul className="mt-2 divide-y divide-ink-100 text-sm">
        {rows.map((f, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2"><span><span className="font-medium">{f.label}</span>{f.actor?.name ? <span className="text-ink-400"> · {f.actor.name}</span> : null}{typeof f.meta?.reason === "string" ? <span className="text-ink-400"> · {f.meta.reason}</span> : null}</span><span className="text-ink-400">{formatDate(f.at)}</span></li>)}
      </ul>
    </Card>
  );
}

function Attachments({ kind, id, rows }: { kind: Kind; id: string; rows?: Attachment[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/v2/accounts/${kind}/${id}/attachments`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Upload failed");
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      toast("Attached", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Upload failed", "error"); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Attachments</h3>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Attach a file" onChange={(e) => upload(e.target.files?.[0])} />
        <Button size="sm" variant="secondary" loading={busy} onClick={() => ref.current?.click()}><Paperclip className="h-4 w-4" /> Attach</Button>
      </div>
      {!rows?.length ? <p className="mt-2 text-sm text-ink-400">No bill or receipt attached yet.</p> : (
        <ul className="mt-2 divide-y divide-ink-100 text-sm">{rows.map((a) => <li key={a._id} className="py-2"><a href={accountsService.attachmentUrl(kind, id, a._id)} target="_blank" rel="noopener" className="text-brand-600 hover:underline">{a.filename || a.contentType}</a><span className="text-ink-400"> · {Math.round(a.size / 1024)} KB</span></li>)}</ul>
      )}
    </Card>
  );
}

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useBill(id);
  const { cancelBill } = useAccountsMutations();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [reentering, setReentering] = useState(false);
  const navigate = useNavigate();
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) return <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">{(error as Error | null)?.message ?? "Bill not found"}</p>;
  const { bill, payments, notes } = data;
  const canPay = (bill.status === "open" || bill.status === "part_paid") && (bill.outstanding ?? 0) > 0;
  return (
    <>
      <Link to="/accounts/bills" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Supplier bills</Link>
      <PageHeader title={bill.billNo} subtitle={`${bill.supplierName} · their ${bill.supplierBillNo} dated ${formatDate(bill.billDate)}`}
        actions={<>
          {canPay && <Button onClick={() => setPaying(true)}><Wallet className="h-4 w-4" /> Record payment</Button>}
          {bill.status !== "cancelled" && bill.paidAmount === 0 && bill.debitedAmount === 0 && <Button variant="secondary" onClick={() => setReentering(true)}><RotateCcw className="h-4 w-4" /> Cancel and re-enter</Button>}
          {bill.status !== "cancelled" && bill.paidAmount === 0 && bill.debitedAmount === 0 && <Button variant="danger" onClick={() => setCancelOpen(true)}><XCircle className="h-4 w-4" /> Cancel</Button>}
        </>} />
      <div className="mb-4 flex flex-wrap gap-2"><StatusChip tone={billTone[bill.status]}>{billLabel[bill.status]}</StatusChip><StatusChip tone="neutral">{bill.supplyType === "inter" ? "IGST" : "CGST + SGST"}</StatusChip>{bill.tds?.applicable && <StatusChip tone="warning">TDS {bill.tds.section} @ {bill.tds.rate}%</StatusChip>}{bill.itc?.eligible ? <StatusChip tone="success">ITC ₹{money(bill.itc.amount)}</StatusChip> : <StatusChip tone="neutral">No input credit</StatusChip>}{bill.status === "cancelled" && bill.cancel?.reason && <span className="text-sm text-status-danger">Cancelled: {bill.cancel.reason}</span>}</div>
      <Card className="p-6">
        <DescriptionList columns={3} items={[
          { label: "Supplier", value: <Link to={`/suppliers/${bill.supplier}`} className="text-brand-600 hover:underline">{bill.supplierName}</Link> },
          { label: "Supplier GSTIN", value: bill.supplierGstin || undefined },
          { label: "Purchase order", value: bill.purchaseOrder ? <Link to={`/purchase-orders/${bill.purchaseOrder}`} className="text-brand-600 hover:underline">PO #{bill.poNo}</Link> : bill.kind === "service" ? "Service bill" : undefined },
          { label: "Due", value: formatDate(bill.dueDate) },
          { label: "Paid", value: `₹${money(bill.paidAmount)}${bill.tdsAmount ? ` + TDS ₹${money(bill.tdsAmount)}` : ""}` },
          { label: "Debit notes", value: bill.debitedAmount ? `₹${money(bill.debitedAmount)}` : undefined },
          { label: "Outstanding", value: <span className="font-semibold">₹{money(bill.outstanding)}</span> },
          { label: "Notes", value: bill.notes || undefined },
        ]} />
        <Lines lines={bill.lines} supplyType={bill.supplyType} />
        <p className="mt-3 text-right text-sm">Total <span className="font-semibold tabular-nums">₹{money(bill.totals.grand)}</span> <span className="text-ink-400">(tax ₹{money(bill.totals.tax)})</span></p>
        {bill.reverseCharge && <p className="mt-1 text-right text-sm text-ink-500">Reverse charge: GST of ₹{money(bill.rcm?.tax)} is ours to pay, and to claim</p>}
      </Card>
      {bill.variance && bill.variance.lines.length > 0 && (
        <Card className="mt-4 border-status-warning/40 p-5">
          <h3 className="font-semibold">Off the PO or the receipts by ₹{money(bill.variance.total)}</h3>
          {bill.variance.note && <p className="text-sm text-ink-500">Entered because: {bill.variance.note}</p>}
          <ul className="mt-2 text-sm">{bill.variance.lines.map((l, i) => <li key={i}>{l.description}: billed {l.billedQty} at ₹{l.billRate}{l.poRate ? ` against the PO's ₹${l.poRate}` : ""}{l.receivedQty !== null ? `, ${l.receivedQty} received` : ""} — ₹{money(l.amount)} more</li>)}</ul>
          {bill.status !== "cancelled" && <Link to="/accounts/notes?new=debit" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Raise a debit note for the difference</Link>}
        </Card>
      )}
      {(payments.length > 0 || notes.length > 0) && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold">Settled by</h3>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {payments.map((p) => <li key={p._id} className="flex justify-between py-2"><span><Link to={`/accounts/payments/${p._id}`} className="text-brand-600 hover:underline">{p.voucherNo}</Link> · {formatDate(p.date)} · {p.mode}{p.reference ? ` · ${p.reference}` : ""}</span><span className="tabular-nums">₹{money(p.amount)}{p.tds ? ` (TDS ₹${money(p.tds)})` : ""}</span></li>)}
            {notes.map((n) => <li key={n._id} className="flex justify-between py-2"><span><Link to={`/accounts/notes/${n._id}`} className="text-brand-600 hover:underline">{n.noteNo}</Link> · {formatDate(n.date)} · {n.reason}</span><span className="tabular-nums">₹{money(n.totals?.grand)}</span></li>)}
          </ul>
        </Card>
      )}
      <Attachments kind="bills" id={bill._id} rows={bill.attachments} />
      <History rows={bill.fingerprints} />
      <ReasonDialog open={reentering} onClose={() => setReentering(false)} title={`Cancel ${bill.billNo} and enter it again?`} description="The bill is cancelled with your reason, and the form opens with everything it had, to correct." confirmLabel="Cancel and re-enter" minLength={8} loading={cancelBill.isPending}
        onConfirm={(reason) => cancelBill.mutate({ id: bill._id, reason }, {
          onSuccess: () => navigate("/accounts/bills", { state: { reenter: {
            supplier: { _id: bill.supplier, name: bill.supplierName }, supplierName: bill.supplierName, supplierGstin: bill.supplierGstin ?? "", billNo: bill.supplierBillNo,
            billDate: bill.billDate.slice(0, 10), purchaseOrder: bill.purchaseOrder, aiSuggestion: null, kind: "bill",
            lines: (bill.lines ?? []).map((l) => ({ rawMaterial: l.rawMaterial, description: l.description, hsn: l.hsn, unit: l.unit, quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent })),
          } } }),
          onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error"),
        })} />
      <FormScreen open={paying} onClose={() => setPaying(false)} title={`Pay ${bill.supplierName}`} width="max-w-4xl">
        {paying && <VoucherForm kind="payment" initialParty={{ id: bill.supplier, name: bill.supplierName }} initialDocs={[bill._id]} onDone={(id) => { setPaying(false); navigate(`/accounts/payments/${id}`); }} onCancel={() => setPaying(false)} />}
      </FormScreen>
      <ReasonDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${bill.billNo}?`} description="It leaves the supplier's account. The receipts on it can be billed again." confirmLabel="Cancel bill" minLength={8} loading={cancelBill.isPending}
        onConfirm={(reason) => cancelBill.mutate({ id: bill._id, reason }, { onSuccess: () => { setCancelOpen(false); toast("Bill cancelled", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error") })} />
    </>
  );
}

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useExpense(id);
  const { approveExpense, rejectExpense, payExpense, cancelExpense } = useAccountsMutations();
  const [dialog, setDialog] = useState<"reject" | "pay" | "cancel" | "reenter" | null>(null);
  const navigate = useNavigate();
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) return <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">{(error as Error | null)?.message ?? "Expense not found"}</p>;
  const { expense: e, payments } = data;
  const canApprove = user?.role === "admin" || user?.role === "accounts";
  return (
    <>
      <Link to="/accounts/expenses" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Expenses</Link>
      <PageHeader title={e.expenseNo} subtitle={`${e.categoryName} · ${e.description}`} actions={
        <>
          {e.status === "pending" && canApprove && <><Button onClick={() => approveExpense.mutate({ id: e._id }, { onSuccess: () => toast("Approved", "success"), onError: (err) => toast(err instanceof ApiError ? err.message : "Could not approve", "error") })} loading={approveExpense.isPending}><Check className="h-4 w-4" /> Approve</Button><Button variant="secondary" onClick={() => setDialog("reject")}><X className="h-4 w-4" /> Reject</Button></>}
          {e.status === "approved" && <Button onClick={() => setDialog("pay")}><Banknote className="h-4 w-4" /> Pay</Button>}
          {["pending", "approved", "rejected"].includes(e.status) && e.paidAmount === 0 && e.source !== "claim" && <Button variant="secondary" onClick={() => setDialog("reenter")}><RotateCcw className="h-4 w-4" /> Cancel and re-enter</Button>}
          {["pending", "approved", "rejected"].includes(e.status) && e.paidAmount === 0 && <Button variant="danger" onClick={() => setDialog("cancel")}><XCircle className="h-4 w-4" /> Cancel</Button>}
        </>
      } />
      <div className="mb-4 flex flex-wrap gap-2"><StatusChip tone={expenseTone[e.status]}>{expenseLabel[e.status]}</StatusChip>{e.itc?.eligible && <StatusChip tone="success">ITC ₹{money(e.itc.amount)}</StatusChip>}{e.approval?.byName && <span className="text-sm text-ink-500">{e.status === "rejected" ? "Rejected" : "Approved"} by {e.approval.byName}{e.approval.note ? ` — ${e.approval.note}` : ""}</span>}</div>
      <Card className="p-6">
        <DescriptionList columns={3} items={[
          { label: "Date", value: formatDate(e.date) }, { label: "Due", value: e.dueDate ? formatDate(e.dueDate) : undefined }, { label: "Paid to", value: e.payeeName || undefined }, { label: "Payee GSTIN", value: e.payeeGstin || undefined },
          { label: "Their ref", value: e.refNo || undefined }, { label: "Entered by", value: e.submittedByName || undefined },
          { label: "Paid", value: e.paidAmount ? `₹${money(e.paidAmount)}${typeof e.paidFrom === "object" && e.paidFrom ? ` from ${e.paidFrom.name}` : ""}` : "Not yet" },
          { label: "Notes", value: e.notes || undefined },
        ]} />
        <Lines lines={e.lines} supplyType={e.supplyType} />
        <p className="mt-3 text-right text-sm">Total <span className="font-semibold tabular-nums">₹{money(e.totals.grand)}</span> <span className="text-ink-400">(tax ₹{money(e.totals.tax)})</span></p>
      </Card>
      {payments.length > 0 && <Card className="mt-4 p-5"><h3 className="font-semibold">Paid by</h3><ul className="mt-2 divide-y divide-ink-100 text-sm">{payments.map((p) => <li key={p._id} className="flex justify-between py-2"><span><Link to={`/accounts/payments/${p._id}`} className="text-brand-600 hover:underline">{p.voucherNo}</Link> · {formatDate(p.date)} · {p.accountName}</span><span className="tabular-nums">₹{money(p.amount)}</span></li>)}</ul></Card>}
      <Attachments kind="expenses" id={e._id} rows={e.attachments} />
      <History rows={e.fingerprints} />
      <ReasonDialog open={dialog === "reject"} onClose={() => setDialog(null)} title={`Reject ${e.expenseNo}?`} confirmLabel="Reject" minLength={8} loading={rejectExpense.isPending}
        onConfirm={(reason) => rejectExpense.mutate({ id: e._id, reason }, { onSuccess: () => { setDialog(null); toast("Rejected", "success"); }, onError: (err) => toast(err instanceof ApiError ? err.message : "Could not reject", "error") })} />
      <ReasonDialog open={dialog === "reenter"} onClose={() => setDialog(null)} title={`Cancel ${e.expenseNo} and enter it again?`} description="It is cancelled with your reason, and the form opens with everything it had." confirmLabel="Cancel and re-enter" minLength={8} loading={cancelExpense.isPending}
        onConfirm={(reason) => cancelExpense.mutate({ id: e._id, reason }, {
          onSuccess: () => navigate("/accounts/expenses", { state: { category: e.category, reenter: {
            supplier: e.supplier ? { _id: e.supplier, name: e.payeeName ?? "" } : undefined, supplierName: e.payeeName ?? "", supplierGstin: e.payeeGstin ?? "", billNo: e.refNo ?? "",
            billDate: e.date.slice(0, 10), aiSuggestion: null, kind: "bill",
            lines: (e.lines ?? []).map((l) => ({ description: l.description, hsn: l.hsn, unit: l.unit, quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent })),
          } } }),
          onError: (err) => toast(err instanceof ApiError ? err.message : "Could not cancel", "error"),
        })} />
      <ReasonDialog open={dialog === "cancel"} onClose={() => setDialog(null)} title={`Cancel ${e.expenseNo}?`} confirmLabel="Cancel expense" minLength={8} loading={cancelExpense.isPending}
        onConfirm={(reason) => cancelExpense.mutate({ id: e._id, reason }, { onSuccess: () => { setDialog(null); toast("Cancelled", "success"); }, onError: (err) => toast(err instanceof ApiError ? err.message : "Could not cancel", "error") })} />
      {dialog === "pay" && <PayDialog title={`Pay ${e.expenseNo}`} amount={e.totals.grand - e.paidAmount} loading={payExpense.isPending} onClose={() => setDialog(null)}
        onConfirm={(body) => payExpense.mutate({ id: e._id, body }, { onSuccess: (r) => { setDialog(null); toast(`Paid — voucher ${r.voucher.voucherNo}`, "success"); }, onError: (err) => toast(err instanceof ApiError ? err.message : "Could not pay", "error") })} />}
    </>
  );
}

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useNote(id);
  const { cancelNote } = useAccountsMutations();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [irnOpen, setIrnOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState("");
  const qc = useQueryClient();
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) return <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">{(error as Error | null)?.message ?? "Note not found"}</p>;
  const n = data.note;
  const toCustomer = n.partyType === "customer";
  const registered = n.einvoice?.status === "registered";
  const refresh = () => qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
  const json = async () => {
    setBusy("json");
    try {
      const blob = await accountsService.noteEinvoiceJson(n._id);
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${n.noteNo.replace(/\//g, "-")}-einvoice.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not build the JSON", "error"); } finally { setBusy(""); }
  };
  const register = async () => {
    setBusy("irn");
    try { const r = await accountsService.registerNoteIrn(n._id); toast(`IRN registered — ${r.note.einvoice?.irn}`, "success"); refresh(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not register", "error"); if (e instanceof ApiError && e.code === "EINVOICE_NOT_CONFIGURED") setIrnOpen(true); }
    finally { setBusy(""); }
  };
  const party = n.partyType === "customer" ? n.customer : n.supplier;
  const credit: Credit | null = n.status === "issued" && (n.unapplied ?? 0) > 0 && party
    ? { sourceType: "AccountNote", id: n._id, docNo: n.noteNo, date: n.date, amount: n.totals.grand, available: n.unapplied ?? 0, label: n.reason }
    : null;
  const againstPath = n.against.docType === "Invoice" ? `/invoices/${n.against.doc}` : `/accounts/bills/${n.against.doc}`;
  return (
    <>
      <Link to="/accounts/notes" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Credit / debit notes</Link>
      <PageHeader title={n.noteNo} subtitle={`${noteKindLabel(n)} · ${n.partyName} · ${formatDate(n.date)}`} actions={<>
        <a href={accountsService.notePdfUrl(n._id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"><FileDown className="h-4 w-4" /> PDF</a>
        {toCustomer && <Button variant="secondary" onClick={json} loading={busy === "json"}><FileJson className="h-4 w-4" /> e-Invoice JSON</Button>}
        {toCustomer && n.status === "issued" && !registered && <><Button variant="secondary" onClick={register} loading={busy === "irn"}><BadgeCheck className="h-4 w-4" /> Register IRN</Button><Button variant="secondary" onClick={() => setIrnOpen(true)}><ClipboardPaste className="h-4 w-4" /> Paste IRN</Button></>}
        <Button variant="secondary" onClick={() => setSharing(true)}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
        {credit && <Button onClick={() => setApplying(true)}>Apply ₹{money(credit.available)}</Button>}
        {n.status === "issued" && <Button variant="danger" onClick={() => setCancelOpen(true)}><XCircle className="h-4 w-4" /> Cancel</Button>}
      </>} />
      <div className="mb-4 flex flex-wrap gap-2"><StatusChip tone={n.status === "issued" ? "success" : "danger"}>{n.status}</StatusChip><StatusChip tone={n.kind === "credit" ? "info" : "warning"}>{noteKindLabel(n)}</StatusChip>{(n.unapplied ?? 0) > 0 && <StatusChip tone="warning">₹{money(n.unapplied)} unapplied</StatusChip>}{registered && <StatusChip tone="success">IRN {n.einvoice?.irn?.slice(0, 12)}…</StatusChip>}{n.status === "cancelled" && n.cancel?.reason && <span className="text-sm text-status-danger">Cancelled: {n.cancel.reason}</span>}</div>
      <Card className="p-6">
        <DescriptionList columns={3} items={[
          { label: "Against", value: <Link to={againstPath} className="text-brand-600 hover:underline">{n.against.docNo}</Link> }, { label: "Reason", value: n.reason }, { label: "Party GSTIN", value: n.partyGstin || undefined },
          { label: "Their note no.", value: n.partyNoteNo || undefined },
          { label: "Applied to it", value: n.applied !== undefined ? `₹${money(n.applied)}` : undefined },
          { label: "Applied elsewhere", value: n.applications?.length ? n.applications.map((a) => `${a.docNo} ₹${money(a.amount)}`).join(", ") : undefined },
          { label: "Notes", value: n.notes || undefined },
        ]} />
        <Lines lines={n.lines} supplyType={n.supplyType} />
        <p className="mt-3 text-right text-sm">Total <span className="font-semibold tabular-nums">₹{money(n.totals.grand)}</span> <span className="text-ink-400">(tax ₹{money(n.totals.tax)})</span></p>
      </Card>
      <History rows={n.fingerprints} />
      {applying && credit && party && <ApplyCreditDialog credit={credit} partyType={n.partyType} party={party} onClose={() => setApplying(false)} />}
      {irnOpen && <IrnDialog invoiceNumber={n.noteNo} onClose={() => setIrnOpen(false)} onConfirm={(body) => accountsService.pasteNoteIrn(n._id, body).then(() => { setIrnOpen(false); toast("IRN recorded", "success"); refresh(); }).catch((e) => toast(e instanceof ApiError ? e.message : "Could not record the IRN", "error"))} />}
      {sharing && <ShareDialog what={{ kind: "note", id: n._id }} customer={toCustomer ? n.customer : undefined} onClose={() => setSharing(false)} />}
      <ReasonDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${n.noteNo}?`} description="The amount goes back onto the documents it was applied to." confirmLabel="Cancel note" minLength={8} loading={cancelNote.isPending}
        onConfirm={(reason) => cancelNote.mutate({ id: n._id, reason }, { onSuccess: () => { setCancelOpen(false); toast("Note cancelled", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error") })} />
    </>
  );
}

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = usePayment(id);
  const { cancelPayment } = useAccountsMutations();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sharing, setSharing] = useState(false);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) return <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">{(error as Error | null)?.message ?? "Voucher not found"}</p>;
  const p = data.payment;
  const party = p.partyType === "customer" ? p.customer : p.partyType === "supplier" ? p.supplier : undefined;
  const credit: Credit | null = p.status === "posted" && p.unallocated > 0.005 && party
    ? { sourceType: "Payment", id: p._id, docNo: p.voucherNo, date: p.date, amount: p.amount, available: p.unallocated, label: p.kind === "receipt" ? "Received on account" : "Paid on account" }
    : null;
  const docPath = (t: string, d: string) => (t === "Invoice" ? `/invoices/${d}` : t === "SupplierBill" ? `/accounts/bills/${d}` : t === "OpeningBalance" ? "/accounts/opening" : `/accounts/expenses/${d}`);
  return (
    <>
      <Link to="/accounts/vouchers" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Receipts &amp; payments</Link>
      <PageHeader title={p.voucherNo} subtitle={`${p.kind === "receipt" ? "Received from" : "Paid to"} ${p.partyName} · ${formatDate(p.date)}`} actions={<>
        <a href={accountsService.paymentPdfUrl(p._id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"><FileDown className="h-4 w-4" /> {p.kind === "receipt" ? "Receipt" : "Payment advice"}</a>
        {p.partyType !== "other" && <Button variant="secondary" onClick={() => setSharing(true)}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>}
        {credit && <Button onClick={() => setApplying(true)}>Apply ₹{money(credit.available)}</Button>}
        {p.status === "posted" && <Button variant="danger" onClick={() => setCancelOpen(true)}><XCircle className="h-4 w-4" /> Cancel</Button>}
      </>} />
      <div className="mb-4 flex flex-wrap gap-2"><StatusChip tone={p.status === "posted" ? "success" : "danger"}>{p.status}</StatusChip><StatusChip tone={p.kind === "receipt" ? "success" : "info"}>{p.kind}</StatusChip>{p.status === "cancelled" && p.cancel?.reason && <span className="text-sm text-status-danger">Cancelled: {p.cancel.reason}</span>}</div>
      <Card className="p-6">
        <DescriptionList columns={3} items={[
          { label: "Amount", value: <span className="font-semibold">₹{money(p.amount)}</span> }, { label: "Through", value: `${p.accountName || "—"} · ${p.mode}` }, { label: "Reference", value: p.reference || undefined },
          { label: "TDS", value: p.tds?.amount ? `₹${money(p.tds.amount)} (${p.tds.section} @ ${p.tds.rate}%${p.tds.base ? ` on ₹${money(p.tds.base)}` : ""})` : undefined },
          { label: "Adjusted", value: p.adjustments?.length ? p.adjustments.map((a) => `${ADJUSTMENT_LABELS[a.kind]} ₹${money(a.amount)}`).join(", ") : undefined },
          { label: "Left on account", value: p.unallocated ? `₹${money(p.unallocated)}` : undefined }, { label: "Cleared in bank", value: p.clearedOn ? formatDate(p.clearedOn) : undefined }, { label: "Narration", value: p.narration || undefined },
        ]} />
        {p.allocations.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2 text-left font-medium">Settles</th><th className="py-2 text-right font-medium">Gross</th><th className="py-2 text-right font-medium">TDS</th><th className="py-2 text-right font-medium">Paid</th></tr></thead>
            <tbody className="divide-y divide-ink-100">{p.allocations.map((a) => <tr key={a.doc}><td className="py-2"><Link to={docPath(a.docType, a.doc)} className="text-brand-600 hover:underline">{a.docNo}</Link>{a.appliedAt && <span className="text-xs text-ink-400"> · applied {formatDate(a.appliedAt)}</span>}</td><td className="py-2 text-right tabular-nums">{money(a.amount)}</td><td className="py-2 text-right tabular-nums">{a.tds ? money(a.tds) : "—"}</td><td className="py-2 text-right tabular-nums font-medium">{money(a.amount - a.tds)}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
      <Attachments kind="payments" id={p._id} rows={undefined} />
      <History rows={p.fingerprints} />
      {applying && credit && party && <ApplyCreditDialog credit={credit} partyType={p.partyType as "customer" | "supplier"} party={party} onClose={() => setApplying(false)} />}
      {sharing && <ShareDialog what={{ kind: "payment", id: p._id }} customer={p.partyType === "customer" ? p.customer : undefined} onClose={() => setSharing(false)} />}
      <ReasonDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${p.voucherNo}?`} description="Every document it settled goes back to outstanding." confirmLabel="Cancel voucher" minLength={8} loading={cancelPayment.isPending}
        onConfirm={(reason) => cancelPayment.mutate({ id: p._id, reason }, { onSuccess: () => { setCancelOpen(false); toast("Voucher cancelled", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error") })} />
    </>
  );
}
