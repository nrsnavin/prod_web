import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, History, ListPlus, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchInput } from "@/components/ui/SearchInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/core/auth/useAuth";
import { ApiError } from "@/core/http/httpClient";
import { newRequestId } from "@/core/hooks/useRequestId";
import { formatDate } from "@/core/format/date";
import { useAccountsMutations, useOpeningOnboarding } from "./hooks";
import { money } from "./shared";
import type { OpeningOnboardingParty } from "./types";

// ══════════════════════════════════════════════════════════════════
//  OPENING BALANCES, ON THE DASHBOARD, UNTIL EVERY PARTY IS SET
//
//  The first job when the books start here: for each customer and
//  supplier, what was owed either way on that day. Each is set right
//  in the list — one amount, nothing owed, or bill by bill — and drops
//  off. When none is left the card says so once and is gone for good.
// ══════════════════════════════════════════════════════════════════

type Kind = "due" | "advance";
const sides = (t: "customer" | "supplier") => [
  { value: "due", label: t === "customer" ? "They owe us" : "We owe them" },
  { value: "advance", label: t === "customer" ? "They paid ahead" : "We paid ahead" },
];
const err = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function OpeningOnboardingCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState<"" | "customer" | "supplier">("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [billWise, setBillWise] = useState<OpeningOnboardingParty | null>(null);
  const [closing, setClosing] = useState(false);
  const [finished, setFinished] = useState(false);
  const { data, isLoading, isError } = useOpeningOnboarding({ partyType: show || undefined, search: search || undefined, limit });
  const { setOpeningAsOn, closeOpeningOnboarding } = useAccountsMutations();
  const [asOn, setAsOn] = useState("");
  useEffect(() => { if (data?.asOn) setAsOn(data.asOn); }, [data?.asOn]);
  // The call that found none left says so only once: hold on to it.
  useEffect(() => { if (data?.justFinished) setFinished(true); }, [data?.justFinished]);

  if (finished) {
    return (
      <Card className="mb-4 flex items-start gap-3 p-4" aria-label="Opening balances">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-ink-900">Every opening balance is set</p>
          <p className="text-ink-500">Each customer's and supplier's account starts from the right figure. They are listed under <Link className="text-brand-600 underline decoration-brand-600/40 underline-offset-2 hover:decoration-current" to="/accounts/opening">Accounts → Opening balances</Link>.</p>
        </div>
        <Button size="sm" variant="ghost" aria-label="Dismiss" onClick={() => setFinished(false)}><X className="h-4 w-4" /></Button>
      </Card>
    );
  }
  if (isLoading || isError || !data?.active) return null;

  const c = data.customers ?? { total: 0, left: 0 };
  const s = data.suppliers ?? { total: 0, left: 0 };
  const total = c.total + s.total;
  const set = total - c.left - s.left;
  const pct = total ? Math.round((set / total) * 100) : 0;
  const rows = data.left ?? [];

  const saveAsOn = (v: string) => {
    setAsOn(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setOpeningAsOn.mutate(v, { onError: (e) => toast(err(e, "Could not save the date"), "error") });
  };

  return (
    <Card className="mb-4 p-4 sm:p-5" aria-label="Opening balances">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-semibold text-ink-900"><History className="h-4 w-4 text-brand-500" /> Set opening balances</h3>
          <p className="mt-0.5 max-w-prose text-sm text-ink-500">What each customer and supplier owed, either way, on the day the books start here. Each one leaves this list once it is set; the card goes when all are.</p>
        </div>
        <div className="w-40">
          <Input label="Balances as on" type="date" value={asOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => saveAsOn(e.target.value)} />
        </div>
      </div>

      <div className="mt-3" aria-label="Progress">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
          <span><span className="font-semibold tabular-nums text-ink-900">{c.total - c.left}</span> of {c.total} customers set</span>
          <span><span className="font-semibold tabular-nums text-ink-900">{s.total - s.left}</span> of {s.total} suppliers set</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% set`}>
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChips value={show} onChange={(v) => { setShow(v); setLimit(10); }} options={[
          { value: "", label: `All ${c.left + s.left}` },
          { value: "customer", label: `Customers ${c.left}` },
          { value: "supplier", label: `Suppliers ${s.left}` },
        ]} />
        <SearchInput value={search} onChange={(v) => { setSearch(v); setLimit(10); }} placeholder="Find a party…" className="ml-auto w-full sm:w-56" />
      </div>

      <ul className="mt-3 divide-y divide-ink-100" aria-label="Parties to set">
        {rows.length === 0 && <li className="py-3 text-sm text-ink-400">No one left here{search ? ` matching "${search}"` : ""}.</li>}
        {rows.map((p) => <PartyRow key={`${p.partyType}:${p._id}`} p={p} asOn={asOn} onBillWise={() => setBillWise(p)} />)}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {(data.more ?? 0) > 0 && <Button size="sm" variant="secondary" onClick={() => setLimit((n) => n + 20)}>Show {Math.min(20, data.more ?? 0)} more of {data.more}</Button>}
        <Link to="/accounts/opening" className="text-brand-600 hover:underline">Import them all from Tally</Link>
        {user?.role === "admin" && <button type="button" className="ml-auto text-ink-500 hover:text-ink-800" onClick={() => setClosing(true)}>Stop showing this</button>}
      </div>

      {billWise && <BillWise p={billWise} asOn={asOn} onClose={() => setBillWise(null)} />}
      <ConfirmDialog open={closing} title="Stop showing opening balances?" confirmLabel="Stop showing"
        message={`${c.left + s.left} ${c.left + s.left === 1 ? "party has" : "parties have"} no opening balance yet. Their accounts will start from zero until one is added from their own page or Accounts → Opening balances. The card will not come back.`}
        loading={closeOpeningOnboarding.isPending} onCancel={() => setClosing(false)}
        onConfirm={() => closeOpeningOnboarding.mutate(undefined, { onSuccess: () => setClosing(false), onError: (e) => toast(err(e, "Could not stop it"), "error") })} />
    </Card>
  );
}

function PartyRow({ p, asOn, onBillWise }: { p: OpeningOnboardingParty; asOn: string; onBillWise: () => void }) {
  const { toast } = useToast();
  const { createOpening, markOpeningNone } = useAccountsMutations();
  const [kind, setKind] = useState<Kind>("due");
  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const ready = value > 0 && !!asOn;
  const save = () => createOpening.mutate(
    { partyType: p.partyType, party: p._id, kind, date: asOn, amount: value, notes: "Set from the dashboard" },
    { onSuccess: (o) => toast(`${p.name}: ₹${money(o.amount)} ${sides(p.partyType).find((x) => x.value === kind)!.label.toLowerCase()} · ${o.docNo}`, "success"), onError: (e) => toast(err(e, "Could not save"), "error") },
  );
  const none = () => markOpeningNone.mutate({ partyType: p.partyType, party: p._id }, {
    onSuccess: () => toast(`${p.name}: nothing owed`, "success"), onError: (e) => toast(err(e, "Could not save"), "error"),
  });
  const busy = createOpening.isPending || markOpeningNone.isPending;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5" aria-label={p.name}>
      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <p className="truncate font-medium text-ink-900">{p.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-ink-400">
          <StatusChip tone={p.partyType === "customer" ? "info" : "neutral"}>{p.partyType === "customer" ? "Customer" : "Supplier"}</StatusChip>
          {p.gstin && <span className="font-mono">{p.gstin}</span>}
        </p>
      </div>
      <div className="w-36"><Select aria-label={`${p.name}: which way`} value={kind} onChange={(e) => setKind(e.target.value as Kind)} options={sides(p.partyType)} /></div>
      <div className="w-32">
        <Input aria-label={`${p.name}: amount`} type="number" inputMode="decimal" min={0} step="0.01" placeholder="₹ 0.00" value={amount}
          onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) save(); }} />
      </div>
      <Button size="sm" disabled={!ready || busy} loading={createOpening.isPending} onClick={save}>Save</Button>
      <Button size="sm" variant="secondary" disabled={busy} loading={markOpeningNone.isPending} onClick={none}>Nothing owed</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onBillWise} aria-label={`${p.name}: bill by bill`} title="Bill by bill"><ListPlus className="h-4 w-4" /></Button>
    </li>
  );
}

interface Line { id: string; refNo: string; date: string; dueDate: string; kind: Kind; amount: string }

/** One row per open bill from the old ledger, so the ageing is right. */
function BillWise({ p, asOn, onClose }: { p: OpeningOnboardingParty; asOn: string; onClose: () => void }) {
  const { toast } = useToast();
  const { bulkOpening } = useAccountsMutations();
  const blank = (): Line => ({ id: newRequestId(), refNo: "", date: asOn, dueDate: "", kind: "due", amount: "" });
  const [lines, setLines] = useState<Line[]>([blank(), blank()]);
  const [problems, setProblems] = useState<Record<number, string>>({});
  const edit = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const filled = lines.filter((l) => Number(l.amount) > 0);
  const ready = filled.length > 0 && filled.every((l) => l.date);
  const net = filled.reduce((t, l) => t + (l.kind === "due" ? 1 : -1) * Number(l.amount), 0);
  const post = () => bulkOpening.mutate(
    filled.map((l) => ({ partyType: p.partyType, party: p._id, kind: l.kind, refNo: l.refNo.trim(), date: l.date, dueDate: l.dueDate || null, amount: Number(l.amount), requestId: `onboard:${l.id}:${l.date}:${l.amount}:${l.kind}` })),
    {
      onSuccess: (r) => {
        // A bill already in the books — the same party, side, date, number and amount — is answered
        // with the balance that is there, and not posted a second time.
        const again = r.results.filter((x) => x.ok && x.replay);
        const fresh = r.posted - again.length;
        if (r.failed === 0 && again.length === 0) { toast(`${p.name}: ${r.posted} ${r.posted === 1 ? "bill" : "bills"} posted`, "success"); onClose(); return; }
        // Keep on screen what failed, with why, and what was already there, as what; what posted is done.
        const left = r.results.filter((x) => !x.ok || x.replay);
        setLines(left.map((x) => filled[x.index]));
        setProblems(Object.fromEntries(left.map((x, i) => [i, x.ok ? `Already in the books${x.docNo ? ` as ${x.docNo}` : ""}, not posted again. If this is another bill, give it its own number.` : x.error ?? "Not posted"])));
        toast(`${fresh} posted${again.length ? `, ${again.length} already there` : ""}${r.failed ? `, ${r.failed} not` : ""} — see the rows left`, r.failed ? "error" : "info");
      },
      onError: (e) => toast(err(e, "Could not post"), "error"),
    },
  );
  const side = sides(p.partyType);
  return (
    <Modal open onClose={onClose} title={`${p.name}, bill by bill`} width="max-w-3xl">
      <p className="mb-3 text-sm text-ink-500">One row per bill still open in the old books, with its own date, so it ages from the day it was billed. Leave a row's amount blank to skip it.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" aria-label="Bills">
          <thead>
            <tr className="text-left text-xs text-ink-500 font-medium">
              <th className="pb-1 font-medium">Old bill no.</th><th className="pb-1 font-medium">Bill date</th><th className="pb-1 font-medium">Due</th><th className="pb-1 font-medium">Which way</th><th className="pb-1 text-right font-medium">Amount (₹)</th><th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="align-top">
                <td className="py-1 pr-2"><Input aria-label={`Bill ${i + 1} number`} value={l.refNo} onChange={(e) => edit(i, { refNo: e.target.value })} placeholder="As in Tally" /></td>
                <td className="py-1 pr-2"><Input aria-label={`Bill ${i + 1} date`} type="date" value={l.date} onChange={(e) => edit(i, { date: e.target.value })} /></td>
                <td className="py-1 pr-2"><Input aria-label={`Bill ${i + 1} due`} type="date" value={l.dueDate} disabled={l.kind === "advance"} onChange={(e) => edit(i, { dueDate: e.target.value })} /></td>
                <td className="py-1 pr-2"><Select aria-label={`Bill ${i + 1} which way`} value={l.kind} onChange={(e) => edit(i, { kind: e.target.value as Kind })} options={side} /></td>
                <td className="py-1 pr-2">
                  <Input aria-label={`Bill ${i + 1} amount`} type="number" min={0} step="0.01" value={l.amount} onChange={(e) => edit(i, { amount: e.target.value })} className="text-right" />
                  {problems[i] && <p className="mt-0.5 text-xs text-status-danger">{problems[i]}</p>}
                </td>
                <td className="py-1"><Button size="sm" variant="ghost" aria-label={`Remove bill ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <Button size="sm" variant="secondary" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="h-4 w-4" /> Another bill</Button>
        {filled.length > 0 && (
          <span className="ml-auto text-ink-600">
            {filled.length} {filled.length === 1 ? "bill" : "bills"} · {net >= 0 ? side[0].label.toLowerCase() : side[1].label.toLowerCase()} <span className="font-semibold tabular-nums text-ink-900">₹{money(Math.abs(net))}</span> net
          </span>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!ready} loading={bulkOpening.isPending} onClick={post}>Post {filled.length || ""} {filled.length === 1 ? "bill" : "bills"}</Button>
      </div>
      {asOn && <p className="mt-2 text-right text-xs text-ink-400">New rows start dated {formatDate(asOn)}, the day the balances are as on.</p>}
    </Modal>
  );
}
