import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, Plus, Trash2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormScreen } from "@/components/ui/FormScreen";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { round2 } from "@/features/invoices/gst";
import { useAccountsMutations, useBankAccounts, useContras, useJournals, useOpenDocs, usePayments } from "./hooks";
import { JournalForm } from "./JournalForm";
import { PartyPicker, money, today } from "./shared";
import { CreditsCard } from "./Credits";
import { accountsService } from "./api";
import { ADJUSTMENT_KINDS, ADJUSTMENT_LABELS } from "./types";
import type { AdjustmentKind, Contra, Journal, OpenDoc, Payment, PaymentMode, VoucherKind } from "./types";

const columns: Column<Payment>[] = [
  { key: "no", header: "Voucher", render: (p) => <span className="font-medium">{p.voucherNo}</span> },
  { key: "date", header: "Date", render: (p) => formatDate(p.date) },
  { key: "party", header: "Party", render: (p) => p.partyName },
  { key: "amount", header: "Amount (₹)", align: "right", render: (p) => <span className={p.kind === "receipt" ? "text-status-success" : ""}>{p.kind === "receipt" ? "+" : "−"}{money(p.amount)}</span> },
  { key: "tds", header: "TDS (₹)", align: "right", render: (p) => (p.tds?.amount ? money(p.tds.amount) : "—") },
  { key: "mode", header: "Through", render: (p) => `${p.accountName || "—"} · ${p.mode}${p.reference ? ` · ${p.reference}` : ""}` },
  { key: "docs", header: "Settles", render: (p) => p.allocations.map((a) => a.docNo).join(", ") || (p.unallocated ? "On account" : "—"), cellClassName: "whitespace-normal" },
  { key: "status", header: "Status", render: (p) => <StatusChip tone={p.status === "posted" ? "success" : "danger"}>{p.status}</StatusChip> },
];

type Filter = VoucherKind | "all" | "contra" | "journal";

export function VouchersTab() {
  const [page, setPage] = useState(1);
  const [params, setParams] = useSearchParams();
  // A journal opened from a ledger (?journal=id) lands on the journals list with it open.
  const [kind, setKind] = useState<Filter>(params.get("journal") ? "journal" : "all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data, isLoading } = usePayments({ page, kind: kind === "contra" || kind === "journal" ? "all" : kind, search });
  const newParam = params.get("new");
  const creating = newParam === "receipt" || newParam === "payment" ? (newParam as VoucherKind) : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {kind !== "contra" && kind !== "journal" && <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Voucher no., party, reference, document…" className="w-full max-w-xs" />}
        <FilterChips options={[{ value: "all", label: "Receipts & payments" }, { value: "receipt", label: "Receipts" }, { value: "payment", label: "Payments" }, { value: "contra", label: "Transfers (contras)" }, { value: "journal", label: "Journals" }]} value={kind} onChange={(v) => { setKind(v); setPage(1); }} />
        <span className="ml-auto flex flex-wrap gap-2">
          <a href={accountsService.exportUrl("vouchers")} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-brand-600 hover:bg-brand-50"><Download className="h-4 w-4" /> Excel</a>
          <Button variant="secondary" onClick={() => setParams({ new: "journal" })}><Plus className="h-4 w-4" /> Journal</Button>
          <Button variant="secondary" onClick={() => setParams({ new: "contra" })}><Plus className="h-4 w-4" /> Contra</Button>
          <Button variant="secondary" onClick={() => setParams({ new: "receipt" })}><Plus className="h-4 w-4" /> Receipt</Button>
          <Button onClick={() => setParams({ new: "payment" })}><Plus className="h-4 w-4" /> Payment</Button>
        </span>
      </div>
      {kind === "contra" ? <ContrasList /> : kind === "journal" ? <JournalsList open={params.get("journal")} onOpen={(id) => setParams(id ? { journal: id } : {})} /> : (
        <Card>
          <DataTable columns={columns} rows={data?.payments ?? []} rowKey={(p) => p._id} onRowClick={(p) => navigate(`/accounts/payments/${p._id}`)} loading={isLoading}
            emptyTitle="No vouchers yet" emptyDescription="Record a customer's payment as a receipt, and what you pay out as a payment." />
          <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
        </Card>
      )}
      <FormScreen open={!!creating} onClose={() => setParams({})} title={creating === "receipt" ? "Record a receipt" : "Record a payment"} width="max-w-4xl">
        {creating && <VoucherForm kind={creating} onDone={(id) => { setParams({}); navigate(`/accounts/payments/${id}`); }} onCancel={() => setParams({})} />}
      </FormScreen>
      <FormScreen open={newParam === "journal"} onClose={() => setParams({})} title="Post a journal" width="max-w-4xl">
        {newParam === "journal" && <JournalForm onDone={(id) => { setParams({ journal: id }); setKind("journal"); }} onCancel={() => setParams({})} />}
      </FormScreen>
      <FormScreen open={newParam === "contra"} onClose={() => setParams({})} title="Move money between accounts" width="max-w-2xl">
        {newParam === "contra" && <ContraForm onDone={() => { setParams({}); setKind("contra"); }} onCancel={() => setParams({})} />}
      </FormScreen>
    </>
  );
}

function ContrasList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useContras({ page });
  const { cancelContra } = useAccountsMutations();
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState<Contra | null>(null);
  const cols: Column<Contra>[] = [
    { key: "no", header: "Contra", render: (c) => <span className="font-medium">{c.contraNo}</span> },
    { key: "date", header: "Date", render: (c) => formatDate(c.date) },
    { key: "from", header: "From", render: (c) => c.fromName },
    { key: "to", header: "To", render: (c) => c.toName },
    { key: "amount", header: "Amount (₹)", align: "right", render: (c) => money(c.amount) },
    { key: "ref", header: "Reference", render: (c) => c.reference || c.narration || "—" },
    { key: "status", header: "Status", render: (c) => c.status === "posted"
      ? <span className="flex items-center gap-2"><StatusChip tone="success">posted</StatusChip><Button size="sm" variant="ghost" aria-label={`Cancel ${c.contraNo}`} onClick={() => setCancelling(c)}><XCircle className="h-4 w-4" /></Button></span>
      : <StatusChip tone="danger">cancelled</StatusChip> },
  ];
  return (
    <Card>
      <DataTable columns={cols} rows={data?.contras ?? []} rowKey={(c) => c._id} loading={isLoading}
        emptyTitle="No contras yet" emptyDescription="Cash drawn from the bank, cash deposited, or money moved between two banks." />
      <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      <ReasonDialog open={!!cancelling} onClose={() => setCancelling(null)} title={`Cancel ${cancelling?.contraNo}?`} description="Both accounts go back to what they were." confirmLabel="Cancel contra" minLength={8} loading={cancelContra.isPending}
        onConfirm={(reason) => cancelling && cancelContra.mutate({ id: cancelling._id, reason }, { onSuccess: () => { setCancelling(null); toast("Contra cancelled", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error") })} />
    </Card>
  );
}

const PURPOSE_LABEL: Record<Journal["purpose"], string> = { setoff: "Set-off", writeoff: "Write-off", accrual: "Accrual", salary: "Salary", depreciation: "Depreciation", stock: "Closing stock", reclass: "Reclassification", other: "Journal" };

function JournalsList({ open, onOpen }: { open: string | null; onOpen: (id: string | null) => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useJournals({ page });
  const { cancelJournal } = useAccountsMutations();
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState<Journal | null>(null);
  const opened = open ? data?.journals.find((j) => j._id === open) : null;
  const cols: Column<Journal>[] = [
    { key: "no", header: "Journal", render: (j) => <span className="font-medium">{j.journalNo}</span> },
    { key: "date", header: "Date", render: (j) => formatDate(j.date) },
    { key: "purpose", header: "For", render: (j) => PURPOSE_LABEL[j.purpose] ?? j.purpose },
    { key: "lines", header: "Lines", render: (j) => j.lines.map((l) => `${l.debit > 0 ? "Dr" : "Cr"} ${l.ledger}`).join(" · ") },
    { key: "amount", header: "Amount (₹)", align: "right", render: (j) => money(j.total) },
    { key: "status", header: "Status", render: (j) => j.status === "posted"
      ? <span className="flex items-center gap-2"><StatusChip tone="success">posted</StatusChip><Button size="sm" variant="ghost" aria-label={`Cancel ${j.journalNo}`} onClick={(e) => { e.stopPropagation(); setCancelling(j); }}><XCircle className="h-4 w-4" /></Button></span>
      : <StatusChip tone="danger">cancelled</StatusChip> },
  ];
  return (
    <Card>
      <DataTable columns={cols} rows={data?.journals ?? []} rowKey={(j) => j._id} loading={isLoading} onRowClick={(j) => onOpen(j._id)}
        emptyTitle="No journals yet" emptyDescription="A set-off between a party's two sides, a write-off, an accrual, salary payable, depreciation: entries with no cash in them." />
      <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      <FormScreen open={!!opened} onClose={() => onOpen(null)} title={opened ? `${opened.journalNo} · ${formatDate(opened.date)}` : ""} width="max-w-3xl" confirmDirtyClose={false}>
        {opened && (
          <div className="space-y-3 text-sm">
            <p><span className="text-ink-500">{PURPOSE_LABEL[opened.purpose] ?? opened.purpose}</span>{opened.narration ? ` · ${opened.narration}` : ""}</p>
            <table className="w-full text-sm" aria-label="Journal lines">
              <thead><tr className="border-y border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2 text-left font-medium">Ledger</th><th className="py-2 text-right font-medium">Debit</th><th className="py-2 text-right font-medium">Credit</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {opened.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1.5">{l.debit > 0 ? "" : <span className="pl-6" />}{l.ledger}{l.refs?.length ? <span className="block text-xs text-ink-400">{l.refs.map((r) => `Agst ${r.docNo} ₹${money(r.amount)}`).join(", ")}</span> : null}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.debit > 0 ? money(l.debit) : ""}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.credit > 0 ? money(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-ink-200 font-semibold"><td className="py-1.5">Total</td><td className="py-1.5 text-right tabular-nums">{money(opened.total)}</td><td className="py-1.5 text-right tabular-nums">{money(opened.total)}</td></tr></tfoot>
            </table>
            <p className="text-ink-500">Reason: {opened.reason}{opened.createdByName ? ` · ${opened.createdByName}` : ""}</p>
            {opened.status === "cancelled" && <p className="text-status-danger">Cancelled: {opened.cancel?.reason}</p>}
          </div>
        )}
      </FormScreen>
      <ReasonDialog open={!!cancelling} onClose={() => setCancelling(null)} title={`Cancel ${cancelling?.journalNo}?`} description="The party ledgers and the documents it settled go back to what they were." confirmLabel="Cancel journal" minLength={8} loading={cancelJournal.isPending}
        onConfirm={(reason) => cancelling && cancelJournal.mutate({ id: cancelling._id, reason }, { onSuccess: () => { setCancelling(null); toast("Journal cancelled", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error") })} />
    </Card>
  );
}

/** Cash drawn, cash deposited, a transfer between two banks. */
export function ContraForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const { createContra } = useAccountsMutations();
  const { data: accounts } = useBankAccounts();
  const list = (accounts ?? []).filter((a) => a.active !== false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const options = list.map((a) => ({ value: a._id, label: `${a.name} (₹${money(a.balance)})` }));
  const ready = from && to && from !== to && Number(amount) > 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="From account *" value={from} onChange={(e) => setFrom(e.target.value)} options={options} placeholder="Where the money left" />
        <Select label="To account *" value={to} onChange={(e) => setTo(e.target.value)} options={options.filter((o) => o.value !== from)} placeholder="Where it went" />
        <Input label="Amount *" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Reference (cheque / UTR)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Cash withdrawn for wages" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button disabled={!ready} loading={createContra.isPending} onClick={() => createContra.mutate(
          { from, to, amount: Number(amount), date, reference: reference.trim() || undefined, narration: narration.trim() || undefined },
          { onSuccess: (c) => { toast(`${c.contraNo} posted`, "success"); onDone(); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not post", "error") }
        )}>Post contra</Button>
      </div>
    </div>
  );
}

/** The share of a document's settlement TDS is deducted on: its value net of GST. */
const tdsShare = (d: OpenDoc) => (d.docType === "OpeningBalance" ? 1 : d.taxableRatio ?? 1);

/**
 * A receipt from a customer or a payment to a supplier (or anyone), with
 * the open documents it settles ticked and the amount against each —
 * never more than is owed. On a payment, TDS is deducted on each ticked
 * document's value net of GST; the cash paid is the rest. A short
 * payment can be settled in full with an adjustment (bank charges,
 * discount, TDS the customer kept, round-off, write-off).
 */
export function VoucherForm({ kind, onDone, onCancel, initialParty, initialDocs }: {
  kind: VoucherKind; onDone: (id: string) => void; onCancel: () => void;
  initialParty?: { id: string; name: string };
  /** Documents to tick when they load (record a payment from the document itself), or "all" of them. */
  initialDocs?: string[] | "all";
}) {
  const { toast } = useToast();
  const { createPayment } = useAccountsMutations();
  const { data: accounts } = useBankAccounts();
  const partyType = kind === "receipt" ? "customer" : "supplier";
  const [other, setOther] = useState(false);
  const [party, setParty] = useState(initialParty?.id ?? "");
  const [partyName, setPartyName] = useState(initialParty?.name ?? "");
  const { data: open, isLoading: loadingDocs } = useOpenDocs(!other && party ? partyType : undefined, !other && party ? party : undefined);
  const [picked, setPicked] = useState<Record<string, number | "">>({});
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState<PaymentMode>("bank");
  const [account, setAccount] = useState("");
  const [reference, setReference] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  // A cheque received is in hand until it is deposited — unless it already was.
  const [chequeDeposited, setChequeDeposited] = useState(false);
  const [tdsRate, setTdsRate] = useState<number | "">("");
  const [tdsSection, setTdsSection] = useState("194C");
  const [amount, setAmount] = useState<number | "">("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [narration, setNarration] = useState("");
  const [adjustments, setAdjustments] = useState<Array<{ kind: AdjustmentKind; amount: number | "" }>>([]);
  const seeded = useRef(false);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPicked({}); setAmountTouched(false); setAdjustments([]);
  }, [party, other]);

  const docs: OpenDoc[] = useMemo(() => open?.docs ?? [], [open]);
  useEffect(() => {
    if (seeded.current || !initialDocs?.length || !docs.length) return;
    seeded.current = true;
    setPicked(Object.fromEntries(docs.filter((d) => initialDocs === "all" || initialDocs.includes(d.id)).map((d) => [d.id, d.outstanding])));
  }, [docs, initialDocs]);

  const rate = kind === "payment" ? Number(tdsRate) || 0 : 0;
  // Per allocation: gross settled, the TDS on it, and the cash it takes.
  const allocs = useMemo(() => docs.filter((d) => picked[d.id] !== undefined && picked[d.id] !== "").map((d) => {
    const gross = round2(Number(picked[d.id]));
    const docRate = kind !== "payment" ? 0 : d.docType === "SupplierBill" ? (rate || d.tds?.rate || 0) : d.docType === "Invoice" ? 0 : rate;
    const base = docRate > 0 ? round2(gross * tdsShare(d)) : 0;
    const tds = round2(base * docRate / 100);
    return { doc: d, gross, base, tds, cash: round2(gross - tds), over: gross > d.outstanding + 0.005 };
  }), [docs, picked, rate, kind]);
  const gross = round2(allocs.reduce((s, a) => s + a.gross, 0));
  const tdsTotal = round2(allocs.reduce((s, a) => s + a.tds, 0));
  const adjTotal = round2(adjustments.reduce((s, a) => s + (Number(a.amount) || 0), 0));
  const cashNeeded = round2(Math.max(0, gross - tdsTotal - adjTotal));
  const cash = amountTouched ? Number(amount) || 0 : cashNeeded;
  const unallocated = round2(cash + tdsTotal + adjTotal - gross);
  const accountList = (accounts ?? []).filter((a) => a.active !== false);
  const chosenAccount = account || accountList.find((a) => a.isDefault)?._id || accountList[0]?._id || "";
  const problems = [
    ...allocs.filter((a) => a.over).map((a) => `${a.doc.docNo} has only ₹${money(a.doc.outstanding)} outstanding`),
    ...(cash + 0.005 < cashNeeded ? [`The ticked documents need ₹${money(cashNeeded)}; the voucher is for ₹${money(cash)}`] : []),
    ...(adjTotal > 0 && adjTotal > gross + 0.005 ? ["Adjustments settle documents — tick the documents they settle"] : []),
    // A discount, write-off or round-off explains why a document was settled short; with money left on account there was nothing to explain. (Bank charges and TDS really left the payment, whatever it settles.)
    ...(adjTotal > 0 && adjTotal <= gross + 0.005 && unallocated > 0.005 && adjustments.some((a) => ["discount", "write_off", "round_off"].includes(a.kind) && Number(a.amount) > 0) ? [`Adjustments settle documents — ₹${money(unallocated)} would be left on account. Tick what they settle, or take them off`] : []),
  ];
  const ready = (other ? partyName.trim() : party) && chosenAccount && cash > 0 && problems.length === 0 && !createPayment.isPending;

  const tick = (d: OpenDoc, on: boolean) => setPicked((p) => { const next = { ...p }; if (on) next[d.id] = d.outstanding; else delete next[d.id]; return next; });

  const submit = () =>
    createPayment.mutate(
      {
        kind, date, partyType: other ? "other" : partyType, ...(other ? { partyName: partyName.trim() } : partyType === "customer" ? { customer: party } : { supplier: party }),
        amount: cash, mode, account: chosenAccount, reference: reference.trim() || undefined,
        cheque: mode === "cheque" ? { number: reference.trim() || undefined, bank: chequeBank.trim() || undefined, date: chequeDate || undefined, ...(kind === "receipt" && chequeDeposited ? { deposited: true } : {}) } : undefined,
        tds: kind === "payment" && rate > 0 ? { section: tdsSection.trim(), rate } : undefined,
        adjustments: adjustments.filter((a) => Number(a.amount) > 0).map((a) => ({ kind: a.kind, amount: Number(a.amount) })),
        allocations: allocs.map((a) => ({ docType: a.doc.docType, doc: a.doc.id, amount: a.gross })),
        narration: narration.trim() || undefined,
      },
      {
        onSuccess: (p) => { toast(`${p.voucherNo} posted`, "success"); onDone(p._id); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not post the voucher", "error"),
      }
    );

  // Settle the ticked documents in full: the shortfall becomes an adjustment.
  const short = amountTouched ? round2(gross - tdsTotal - adjTotal - cash) : 0;
  const fillShort = (k: AdjustmentKind) => {
    if (short <= 0) return;
    setAdjustments((a) => [...a.filter((x) => x.kind !== k), { kind: k, amount: round2((Number(a.find((x) => x.kind === k)?.amount) || 0) + short) }]);
  };

  // Keyboard entry: Ctrl+Enter posts, so a sitting of fifty vouchers needs no mouse.
  const onKeyDown = (e: React.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && ready) { e.preventDefault(); submit(); } };

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      <div className="grid gap-3 sm:grid-cols-2">
        {other ? (
          <Input label="Paid to" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
        ) : (
          <PartyPicker partyType={partyType} value={party} onChange={(id, name) => { setParty(id); setPartyName(name); }} />
        )}
        {kind === "payment" && (
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={other} onChange={(e) => { setOther(e.target.checked); setParty(""); }} /> Not a supplier on file</label>
        )}
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Through account" value={chosenAccount} onChange={(e) => setAccount(e.target.value)} options={accountList.map((a) => ({ value: a._id, label: `${a.name} (₹${money(a.balance)})` }))} />
        <Select label="Mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} options={[{ value: "bank", label: "Bank transfer (NEFT / RTGS / IMPS)" }, { value: "upi", label: "UPI" }, { value: "cheque", label: "Cheque" }, { value: "cash", label: "Cash" }]} />
        <Input label="Reference (UTR / cheque no.)" value={reference} onChange={(e) => setReference(e.target.value)} />
        {mode === "cheque" && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="Drawn on (bank)" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="Kotak, SBI…" />
            <Input label="Cheque date" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} hint={kind === "receipt" ? "Dated ahead: held until its date" : "Dated ahead: held in the cheque register"} />
            {kind === "receipt" && (
              <label className="col-span-2 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={chequeDeposited} onChange={(e) => setChequeDeposited(e.target.checked)} />
                <span>Already deposited at the bank<span className="block text-xs text-ink-400">Otherwise it is recorded as received and in hand; deposit it, and mark it cleared, from the cheque register or the voucher.</span></span>
              </label>
            )}
          </div>
        )}
        {kind === "payment" && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="TDS section" value={tdsSection} onChange={(e) => setTdsSection(e.target.value)} />
            <Input label="TDS rate %" type="number" step="0.01" min={0} max={100} value={tdsRate} placeholder="none" onChange={(e) => setTdsRate(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
        )}
      </div>

      {!other && party && open?.credits && open.credits.length > 0 && <CreditsCard partyType={partyType} party={party} credits={open.credits} />}

      {!other && party && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Settles</p>
          {loadingDocs ? <Skeleton className="h-20 w-full" /> : docs.length === 0 ? (
            <p className="text-sm text-ink-400">Nothing open for {partyName || "this party"}{open ? ` — balance on account ₹${money(open.balance)}` : ""}. The amount stays on account.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2" /><th className="py-2 text-left font-medium">Document</th><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-right font-medium">Outstanding</th>
                    <th className="py-2 text-right font-medium">Settle (gross)</th>{kind === "payment" && <th className="py-2 text-right font-medium">TDS</th>}{kind === "payment" && <th className="py-2 text-right font-medium">Pay</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {docs.map((d) => {
                    const a = allocs.find((x) => x.doc.id === d.id);
                    return (
                      <tr key={d.id}>
                        <td className="py-1.5 pr-2"><input type="checkbox" aria-label={`Settle ${d.docNo}`} checked={picked[d.id] !== undefined} onChange={(e) => tick(d, e.target.checked)} /></td>
                        <td className="py-1.5 pr-2"><span className="font-medium">{d.docNo}</span>{d.refNo ? <span className="text-ink-400"> · {d.refNo}</span> : null}{d.description ? <span className="block text-xs text-ink-400">{d.description}</span> : null}</td>
                        <td className="py-1.5 pr-2 text-ink-500">{formatDate(d.date)}{d.overdueDays > 0 && <StatusChip tone={d.overdueDays > 60 ? "danger" : "warning"} className="ml-1">{d.overdueDays}d overdue</StatusChip>}</td>
                        <td className="py-1.5 text-right tabular-nums">{money(d.outstanding)}</td>
                        <td className="py-1.5 text-right">
                          <Input aria-label={`Amount for ${d.docNo}`} type="number" step="0.01" min={0} className="w-32 text-right" disabled={picked[d.id] === undefined} value={picked[d.id] ?? ""}
                            onChange={(e) => setPicked((p) => ({ ...p, [d.id]: e.target.value === "" ? "" : Number(e.target.value) }))} error={a?.over ? "over" : undefined} />
                        </td>
                        {kind === "payment" && <td className="py-1.5 text-right tabular-nums" title={a?.tds ? `on ₹${money(a.base)} net of GST` : undefined}>{a ? money(a.tds) : "—"}</td>}
                        {kind === "payment" && <td className="py-1.5 text-right tabular-nums font-medium">{a ? money(a.cash) : "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adjustments.length > 0 && (
        <div aria-label="Adjustments" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Settled besides the money</p>
          {adjustments.map((a, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Select label={`Adjustment ${i + 1}`} value={a.kind} onChange={(e) => setAdjustments((x) => x.map((y, k) => (k === i ? { ...y, kind: e.target.value as AdjustmentKind } : y)))}
                options={ADJUSTMENT_KINDS[kind].map((k) => ({ value: k, label: ADJUSTMENT_LABELS[k] }))} />
              <Input label="Amount" aria-label={`Adjustment ${i + 1} amount`} type="number" step="0.01" min={0} className="w-32 text-right" value={a.amount}
                onChange={(e) => setAdjustments((x) => x.map((y, k) => (k === i ? { ...y, amount: e.target.value === "" ? "" : Number(e.target.value) } : y)))} />
              <Button size="sm" variant="ghost" aria-label={`Remove adjustment ${i + 1}`} onClick={() => setAdjustments((x) => x.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Input label={kind === "receipt" ? "Amount received *" : "Amount paid *"} type="number" step="0.01" min={0} value={amountTouched ? amount : cashNeeded || ""} onChange={(e) => { setAmountTouched(true); setAmount(e.target.value === "" ? "" : Number(e.target.value)); }} />
        <dl className="text-sm sm:col-span-2 self-end" aria-label="Voucher summary">
          {kind === "payment" && tdsTotal > 0 && <div className="flex justify-between"><dt className="text-ink-500">TDS deducted</dt><dd className="tabular-nums">₹{money(tdsTotal)}</dd></div>}
          {adjTotal > 0 && <div className="flex justify-between"><dt className="text-ink-500">Adjusted</dt><dd className="tabular-nums">₹{money(adjTotal)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-500">Settles</dt><dd className="tabular-nums">₹{money(gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Left on account</dt><dd className={`tabular-nums ${unallocated > 0 ? "text-status-warning" : ""}`}>₹{money(Math.max(0, unallocated))}</dd></div>
        </dl>
      </div>
      {gross > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {short > 0.005 && <span className="text-ink-500">₹{money(short)} short — settle it in full as</span>}
          {short > 0.005 && ADJUSTMENT_KINDS[kind].filter((k) => k !== "write_off").map((k) => <Button key={k} size="sm" variant="secondary" onClick={() => fillShort(k)}>{ADJUSTMENT_LABELS[k]}</Button>)}
          {short <= 0.005 && <Button size="sm" variant="ghost" onClick={() => setAdjustments((a) => [...a, { kind: ADJUSTMENT_KINDS[kind][0], amount: "" }])}><Plus className="h-4 w-4" /> Adjustment</Button>}
        </div>
      )}
      {problems.map((p) => <p key={p} className="text-sm text-status-danger">{p}</p>)}
      <Input label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Printed on the statement" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready} loading={createPayment.isPending} title="Ctrl+Enter">{kind === "receipt" ? "Post receipt" : "Post payment"}</Button>
      </div>
    </div>
  );
}
