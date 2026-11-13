import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, Info, OctagonAlert, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useRequestId } from "@/core/hooks/useRequestId";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import type { PaymentRunProposal, PaymentRunRecord, RunLine, RunPriority } from "./types";

// ══════════════════════════════════════════════════════════════════
//  PAY THIS WEEK — the week's payment run (services/paymentRun.js)
//
//  The bills to pay by the week's end, in the order to pay them, and why
//  each is there: a micro or small supplier whose days under the MSMED
//  Act run out, then the overdue, then those falling due. The money it
//  is worked out on is shown: the bank, what else goes out this week (the
//  cash forecast), what is kept back. Suppliers held back are listed with
//  the reason. Nothing is paid until a person ticks, presses Pay and
//  confirms; each supplier is then paid by one bank payment through the
//  normal payment door.
// ══════════════════════════════════════════════════════════════════

const PRIORITY: Record<RunPriority, { label: string; tone: "danger" | "warning" | "info" }> = {
  msme: { label: "MSME days", tone: "danger" },
  overdue: { label: "Overdue", tone: "warning" },
  due: { label: "Due", tone: "info" },
};

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function PaymentRunTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const rid = useRequestId();
  const [horizon, setHorizon] = useState(7);
  const [cushion, setCushion] = useState<number | "">("");
  const [budget, setBudget] = useState<number | "">("");
  const [useReceipts, setUseReceipts] = useState(false);
  const [account, setAccount] = useState("");
  const params = useDebounced({ horizon, cushion, budget, useReceipts, account });
  const run = useQuery({ queryKey: [ACCOUNTS_KEY, "payment-run", params], queryFn: () => accountsService.paymentRun(params) });
  const runs = useQuery({ queryKey: [ACCOUNTS_KEY, "payment-runs"], queryFn: () => accountsService.paymentRuns() });
  const p = run.data;

  // Ticked: the proposal's own lines, afresh each time it changes.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const proposedKey = (p?.lines ?? []).map((l) => l.supplier).join(",");
  useEffect(() => { setTicked(new Set(proposedKey ? proposedKey.split(",") : [])); }, [proposedKey]);
  const all = useMemo(() => [...(p?.lines ?? []), ...(p?.held ?? []), ...(p?.short ?? [])], [p]);
  const chosen = all.filter((l) => ticked.has(l.supplier));
  const total = chosen.reduce((t, l) => t + l.cash, 0);
  const tds = chosen.reduce((t, l) => t + l.tds, 0);
  const needsNote = chosen.filter((l) => (l.holds ?? []).some((h) => h.severity === "confirm") && (notes[l.supplier] ?? "").trim().length < 8);
  const payFrom = p?.cash.payFrom ?? null;
  const toggle = (id: string, on: boolean) => setTicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<PaymentRunRecord | null>(null);
  const pay = async () => {
    if (!payFrom) return;
    const body = {
      account: payFrom._id, suppliers: chosen.map((l) => l.supplier),
      riskNotes: Object.fromEntries(chosen.filter((l) => notes[l.supplier]?.trim()).map((l) => [l.supplier, notes[l.supplier].trim()])),
      horizon, cushion, budget, useReceipts,
    };
    setPaying(true);
    try {
      const out = await accountsService.payRun({ ...body, requestId: rid.for(body) });
      rid.done();
      setResult(out.run);
      setConfirming(false);
      const t = out.run.totals;
      toast(t.failed ? `Paid ${t.paid} of ${t.suppliers}: see what was refused` : `Paid ${t.paid} supplier${t.paid === 1 ? "" : "s"}, ₹${money(t.cash)}`, t.failed ? "info" : "success");
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "The run could not be paid", "error");
    } finally { setPaying(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">Whom to pay{p ? ` by ${formatDate(p.until)}` : ""}, in the order to pay them, and why. Nothing is paid until you tick, press Pay and confirm.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Pay from" value={account || payFrom?._id || ""} onChange={(e) => setAccount(e.target.value)} options={(p?.cash.accounts ?? []).map((a) => ({ value: a._id, label: `${a.name} · ₹${money(a.balance)}` }))} placeholder="A bank account" />
        <Select label="Looking ahead" value={String(horizon)} onChange={(e) => setHorizon(Number(e.target.value))} options={[{ value: "7", label: "This week" }, { value: "14", label: "Two weeks" }]} />
        <Input label="Keep back (₹)" type="number" min={0} step="1000" value={cushion} onChange={(e) => setCushion(e.target.value === "" ? "" : Number(e.target.value))} className="w-36" />
        <Input label="Spend up to (₹)" type="number" min={0} step="1000" value={budget} onChange={(e) => setBudget(e.target.value === "" ? "" : Number(e.target.value))} placeholder="What the bank allows" className="w-44" />
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={useReceipts} onChange={(e) => setUseReceipts(e.target.checked)} /> Count receipts expected{p ? ` (₹${money(p.cash.receipts)})` : ""}</label>
      </div>

      {run.isLoading || !p ? <Skeleton className="h-64 w-full" /> : (
        <>
          <MoneyCard p={p} />
          {p.msmeShort > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
              <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> ₹{money(p.msmeShort)} more is needed to pay the micro and small suppliers whose days run out by {formatDate(p.until)}. Nothing else is proposed until they are paid.
            </p>
          )}

          <Section title="To pay" label="To pay" empty={`Nothing falls due by ${formatDate(p.until)} that the money covers.`} lines={p.lines} ticked={ticked} onToggle={toggle} notes={notes} setNotes={setNotes} />
          {p.held.length > 0 && <Section title="Held back" label="Held back" lines={p.held} ticked={ticked} onToggle={toggle} notes={notes} setNotes={setNotes} />}
          {p.short.length > 0 && <Section title="Not this week" label="Not this week" lines={p.short} ticked={ticked} onToggle={toggle} notes={notes} setNotes={setNotes} />}
          {p.later.count > 0 && <p className="text-sm text-ink-500">{p.later.count} more bill{p.later.count === 1 ? "" : "s"}, ₹{money(p.later.amount)}, fall due after {formatDate(p.until)}.</p>}

          <div className="sticky bottom-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-surface px-4 py-3 shadow-card sm:bottom-2">
            <div className="text-sm">
              <span className="font-semibold tabular-nums">₹{money(total)}</span> to {chosen.length} supplier{chosen.length === 1 ? "" : "s"}{tds > 0 ? <span className="text-ink-500"> · TDS ₹{money(tds)} kept back</span> : null}
              {payFrom && total > payFrom.balance + 0.005 && <span className="block text-xs text-status-warning">{payFrom.name} has ₹{money(payFrom.balance)}: move ₹{money(total - payFrom.balance)} into it first.</span>}
              {needsNote.length > 0 && <span className="block text-xs text-status-warning">Say how you confirmed {needsNote.map((l) => l.supplierName).join(", ")}'s bank account.</span>}
            </div>
            <Button onClick={() => setConfirming(true)} disabled={!chosen.length || !payFrom || needsNote.length > 0}><Send className="h-4 w-4" aria-hidden /> Pay {chosen.length} supplier{chosen.length === 1 ? "" : "s"}</Button>
          </div>
        </>
      )}

      {result && <RunResult run={result} onClose={() => setResult(null)} />}
      <PastRuns runs={runs.data ?? []} />

      <ConfirmDialog open={confirming} title={`Pay ${chosen.length} supplier${chosen.length === 1 ? "" : "s"}?`}
        message={<>₹{money(total)} goes out of {payFrom?.name ?? "the bank"} by bank transfer: one payment a supplier, each settling the bills listed.{tds > 0 ? ` TDS of ₹${money(tds)} is kept back, to deposit.` : ""}</>}
        consequences={chosen.slice(0, 8).map((l) => ({ text: <>{l.supplierName}: ₹{money(l.cash)}</>, tone: (l.holds ?? []).length ? "warning" as const : "info" as const }))}
        confirmLabel={`Pay ₹${money(total)}`} loading={paying} onConfirm={pay} onCancel={() => setConfirming(false)} />
    </div>
  );
}

function MoneyCard({ p }: { p: PaymentRunProposal }) {
  const [open, setOpen] = useState(false);
  const c = p.cash;
  const stat = (label: string, value: string, sub?: string) => (
    <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p><p className="text-lg font-semibold tabular-nums">{value}</p>{sub && <p className="text-xs text-ink-500">{sub}</p>}</div>
  );
  return (
    <Card className="p-5" aria-label="Money for the run">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stat("In the bank", `₹${money(c.bank)}`, `${c.accounts.length} account${c.accounts.length === 1 ? "" : "s"}`)}
        {stat("Going out besides", `₹${money(c.committed)}`, `${c.commitments.length} payment${c.commitments.length === 1 ? "" : "s"} by ${formatDate(p.until)}`)}
        {stat("Kept back", `₹${money(c.cushion)}`)}
        {stat(c.budget != null ? "Budget" : "To spend", `₹${money(c.limit)}`, c.useReceipts ? `with ₹${money(c.receipts)} expected in` : undefined)}
        {stat("In this run", `₹${money(c.proposed)}`, `${p.totals.suppliers} supplier${p.totals.suppliers === 1 ? "" : "s"}`)}
        {stat("Left", `₹${money(c.left)}`)}
      </div>
      {c.forecastError && <p className="mt-3 flex items-center gap-2 text-sm text-status-warning"><AlertTriangle className="h-4 w-4" aria-hidden /> {c.forecastError}</p>}
      {c.commitments.length > 0 && (
        <div className="mt-3">
          <button type="button" className="flex items-center gap-1 text-sm text-brand-600" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
            {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />} What else goes out by {formatDate(p.until)}
          </button>
          {open && (
            <ul className="mt-2 divide-y divide-ink-100 text-sm" aria-label="Going out besides">
              {c.commitments.map((x, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{formatDate(x.date)} · {x.party} <span className="text-ink-400">({x.basis})</span></span><span className="tabular-nums">₹{money(x.amount)}</span></li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
function Section({ title, label, lines, empty, ticked, onToggle, notes, setNotes }: {
  title: string; label: string; lines: RunLine[]; empty?: string; ticked: Set<string>; onToggle: (id: string, on: boolean) => void;
  notes: Record<string, string>; setNotes: (fn: (n: Record<string, string>) => Record<string, string>) => void;
}) {
  return (
    <Card className="p-5" aria-label={label}>
      <h3 className="font-semibold">{title} {lines.length > 0 && <span className="text-sm font-normal text-ink-400">({lines.length})</span>}</h3>
      {lines.length === 0 ? <p className="mt-2 text-sm text-ink-400">{empty}</p> : (
        <ul className="mt-2 divide-y divide-ink-100">
          {lines.map((l) => <RunRow key={l.supplier} line={l} ticked={ticked.has(l.supplier)} onToggle={onToggle} note={notes[l.supplier] ?? ""} onNote={(v) => setNotes((n) => ({ ...n, [l.supplier]: v }))} />)}
        </ul>
      )}
    </Card>
  );
}

function RunRow({ line: l, ticked, onToggle, note, onNote }: { line: RunLine; ticked: boolean; onToggle: (id: string, on: boolean) => void; note: string; onNote: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const blocked = (l.holds ?? []).some((h) => h.severity === "danger");
  const confirm = (l.holds ?? []).some((h) => h.severity === "confirm");
  const reason = l.docs[0]?.reason;
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={ticked && !blocked} disabled={blocked} onChange={(e) => onToggle(l.supplier, e.target.checked)} aria-label={`Pay ${l.supplierName}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/suppliers/${l.supplier}`} className="font-medium hover:underline">{l.supplierName}</Link>
            {l.msme && <StatusChip tone="info">{l.msme}</StatusChip>}
            <StatusChip tone={PRIORITY[l.priority].tone}>{PRIORITY[l.priority].label}</StatusChip>
            <span className="ml-auto text-right font-semibold tabular-nums">₹{money(l.cash)}{l.tds > 0 && <span className="block text-xs font-normal text-ink-500">of ₹{money(l.gross)}, TDS ₹{money(l.tds)}</span>}</span>
          </div>
          <p className="mt-0.5 text-sm text-ink-600">{l.why}{l.docs.length > 1 ? ` · ${l.docs.length} bills` : ""}</p>
          {reason && <p className="text-xs text-ink-500">{reason === "msme" ? "Left until the micro and small suppliers are paid" : "Not enough money this week"}</p>}
          {(l.holds ?? []).map((h) => <p key={h.code} className={`mt-1 flex items-start gap-1.5 text-sm ${h.severity === "danger" ? "text-status-danger" : "text-status-warning"}`}><OctagonAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {h.message}</p>)}
          {l.notes.map((n) => <p key={n} className="mt-1 flex items-start gap-1.5 text-xs text-ink-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {n}</p>)}
          {confirm && ticked && <Input aria-label={`How you confirmed ${l.supplierName}'s account`} placeholder="How you confirmed their account: whom you called, on which number" value={note} onChange={(e) => onNote(e.target.value)} wrapperClassName="mt-2" />}
          <button type="button" className="mt-1 flex items-center gap-1 text-xs text-brand-600" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
            {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />} {open ? "Hide" : "Show"} the bills
          </button>
          {open && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm" aria-label={`Bills of ${l.supplierName}`}>
                <thead><tr className="text-xs text-ink-400"><th className="text-left font-medium">Bill</th><th className="text-left font-medium">Due</th><th className="text-right font-medium">Owed</th><th className="text-right font-medium">TDS</th><th className="text-right font-medium">To pay</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {l.docs.map((d) => (
                    <tr key={d.id}>
                      <td className="py-1">{d.docNo}{d.refNo && <span className="block text-xs text-ink-400">{d.refNo}</span>}</td>
                      <td className="py-1 whitespace-nowrap">{formatDate(d.dueDate)}</td>
                      <td className="py-1 text-right tabular-nums">{money(d.outstanding)}</td>
                      <td className="py-1 text-right tabular-nums">{d.tds ? `${money(d.tds)}${d.section ? ` (${d.section})` : ""}` : ""}</td>
                      <td className="py-1 text-right tabular-nums">{money(d.cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function RunResult({ run, onClose }: { run: PaymentRunRecord; onClose: () => void }) {
  return (
    <Card className="p-5" aria-label="The run as paid">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Paid {run.totals.paid} of {run.totals.suppliers} · ₹{money(run.totals.cash)} from {run.accountName}</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
      </div>
      <ul className="mt-2 divide-y divide-ink-100 text-sm">
        {run.lines.map((l) => (
          <li key={l.supplier} className="flex flex-wrap items-start justify-between gap-2 py-1.5">
            <span>{l.supplierName || "A supplier"}{l.status === "failed" && <span className="block text-xs text-status-danger">{l.error}</span>}</span>
            {l.status === "paid" && l.payment ? <Link to={`/accounts/payments/${l.payment}`} className="tabular-nums text-brand-600 hover:underline">{l.voucherNo} · ₹{money(l.cash)}</Link> : <StatusChip tone="danger">not paid</StatusChip>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PastRuns({ runs }: { runs: PaymentRunRecord[] }) {
  if (!runs.length) return null;
  return (
    <Card className="p-5" aria-label="Runs paid lately">
      <h3 className="font-semibold">Runs paid lately</h3>
      <ul className="mt-2 divide-y divide-ink-100 text-sm">
        {runs.slice(0, 6).map((r) => (
          <li key={r._id} className="flex flex-wrap justify-between gap-2 py-1.5">
            <span>{formatDate(r.createdAt)} · {r.createdByName || "—"} · {r.accountName}</span>
            <span className="tabular-nums">{r.totals?.paid ?? 0} paid{r.totals?.failed ? `, ${r.totals.failed} refused` : ""} · ₹{money(r.totals?.cash ?? 0)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
