import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookOpen, CreditCard, Landmark, Pencil, Plus, Printer, Smartphone, Upload, Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/core/auth/useAuth";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { useAccountsMutations, useBanking, useDeposits } from "./hooks";
import { AccountDialog } from "./SettingsTab";
import { money, today } from "./shared";
import type { AccountKind, BankAccount, BankingAccount, ChequeInHand } from "./types";

// ══════════════════════════════════════════════════════════════════
//  BANKING — every account at a glance
//
//  Each bank, the cash box, UPI and any credit card as a card: what is
//  in it, the cheques in hand that are not in the bank yet, the cheques
//  we gave out that have not cleared, and what the bank has not shown
//  on a statement. From each: receive, pay, transfer, deposit, upload a
//  statement, see its book. Below, the cheques in hand, ticked and
//  deposited in one go with a slip to print.
// ══════════════════════════════════════════════════════════════════

const KIND: Record<AccountKind, { label: string; icon: typeof Landmark }> = {
  bank: { label: "Bank", icon: Landmark },
  cash: { label: "Cash", icon: Wallet },
  upi: { label: "UPI", icon: Smartphone },
  card: { label: "Credit card", icon: CreditCard },
};

export function BankingTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = useBanking();
  const [editing, setEditing] = useState<Partial<BankAccount> | null | undefined>(undefined);
  const [depositing, setDepositing] = useState<{ cheques: ChequeInHand[]; into?: string } | null>(null);
  const accounts = (data?.accounts ?? []).filter((a) => a.active !== false);
  const t = data?.totals;

  return (
    <div className="space-y-4">
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label="In the bank" value={t?.bank} loading={isLoading} hint="book balance of bank and UPI accounts" />
        <Total label="Cash in hand" value={t?.cash} loading={isLoading} />
        <Total label="Cheques in hand" value={t?.chequesInHand} loading={isLoading} hint={`${data?.inHand.length ?? 0} not yet deposited`} tone={t && t.chequesInHand > 0 ? "warning" : undefined} />
        <Total label="Owed on cards" value={t ? Math.abs(Math.min(0, t.card)) : undefined} loading={isLoading} hint="spent, not yet paid off" />
      </section>

      <section aria-label="Accounts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        {accounts.map((a) => (
          <AccountCard key={a._id} a={a} isAdmin={isAdmin} onEdit={() => setEditing(a)}
            onDeposit={() => setDepositing({ cheques: (data?.inHand ?? []).filter((c) => c.due), into: a._id })} />
        ))}
        {isAdmin && !isLoading && (
          <button type="button" onClick={() => setEditing(null)}
            className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 p-4 text-ink-500 transition-colors hover:border-brand-500 hover:text-brand-600">
            <Plus className="h-6 w-6" />
            <span className="font-medium">Add an account</span>
            <span className="text-xs">Bank, cash box, UPI or credit card</span>
          </button>
        )}
      </section>

      <ChequesInHand cheques={data?.inHand ?? []} loading={isLoading} onDeposit={(cheques) => setDepositing({ cheques })} />
      <RecentDeposits />

      {editing !== undefined && <AccountDialog initial={editing} onClose={() => setEditing(undefined)} />}
      {depositing && <DepositDialog cheques={depositing.cheques} into={depositing.into} accounts={data?.accounts ?? []} onClose={() => setDepositing(null)} />}
    </div>
  );
}

function Total({ label, value, loading, hint, tone }: { label: string; value?: number; loading?: boolean; hint?: string; tone?: "warning" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-28" /> : <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warning" ? "text-status-warning" : "text-ink-900"}`}>₹{money(value ?? 0)}</p>}
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}

function AccountCard({ a, isAdmin, onEdit, onDeposit }: { a: BankingAccount; isAdmin: boolean; onEdit: () => void; onDeposit: () => void }) {
  const navigate = useNavigate();
  const k = KIND[a.kind] ?? KIND.bank;
  const Icon = k.icon;
  const owed = a.kind === "card";
  const masked = a.accountNo ? `…${a.accountNo.slice(-4)}` : "";
  const go = (to: string) => navigate(to);
  return (
    <Card className="flex flex-col p-4" aria-label={a.name}>
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-brand-50 p-2 text-brand-600"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-900">{a.name}{a.isDefault && <StatusChip tone="info" className="ml-2">default</StatusChip>}</p>
          <p className="truncate text-xs text-ink-400">{[k.label, a.bankName, masked, a.ifsc, a.upiId].filter(Boolean).join(" · ")}</p>
        </div>
        {isAdmin && <Button size="sm" variant="ghost" aria-label={`Edit ${a.name}`} onClick={onEdit}><Pencil className="h-4 w-4" /></Button>}
      </div>
      <p className={`mt-3 text-2xl font-semibold tabular-nums ${owed && a.balance < 0 ? "text-status-danger" : a.balance < 0 ? "text-status-danger" : "text-ink-900"}`}>
        ₹{money(Math.abs(a.balance))}{owed && a.balance < 0 ? <span className="ml-1 text-sm font-normal text-ink-500">owed</span> : a.balance < 0 ? <span className="ml-1 text-sm font-normal">overdrawn</span> : null}
      </p>
      <ul className="mt-2 space-y-0.5 text-xs text-ink-500">
        {a.chequesInHand.count > 0 && <li className="text-status-warning">{a.chequesInHand.count} cheque{a.chequesInHand.count === 1 ? "" : "s"} in hand, not deposited · ₹{money(a.chequesInHand.amount)}</li>}
        {a.chequesIssued.count > 0 && <li>{a.chequesIssued.count} cheque{a.chequesIssued.count === 1 ? "" : "s"} issued, not cleared · ₹{money(a.chequesIssued.amount)}</li>}
        {a.kind !== "cash" && a.notOnStatement > 0 && <li>{a.notOnStatement} not yet on a bank statement</li>}
        {a.kind === "bank" && <li>{a.lastStatement ? `Last statement to ${formatDate(a.lastStatement)}` : "No statement uploaded yet"}</li>}
      </ul>
      <div className="mt-auto flex flex-wrap gap-1 pt-3">
        {a.kind !== "card" && <Button size="sm" variant="secondary" onClick={() => go(`/accounts/vouchers?new=receipt&account=${a._id}`)}><ArrowDownLeft className="h-4 w-4" /> Receive</Button>}
        <Button size="sm" variant="secondary" onClick={() => go(`/accounts/vouchers?new=payment&account=${a._id}`)}><ArrowUpRight className="h-4 w-4" /> {a.kind === "card" ? "Spend" : "Pay"}</Button>
        <Button size="sm" variant="ghost" onClick={() => go(a.kind === "card" ? `/accounts/vouchers?new=contra&to=${a._id}` : `/accounts/vouchers?new=contra&from=${a._id}`)}>
          <ArrowLeftRight className="h-4 w-4" /> {a.kind === "card" ? "Pay card bill" : "Transfer"}
        </Button>
        {a.kind === "bank" && <Button size="sm" variant="ghost" onClick={onDeposit}><Landmark className="h-4 w-4" /> Deposit</Button>}
        {a.kind === "bank" && <Button size="sm" variant="ghost" onClick={() => go(`/accounts/bank?account=${a._id}`)}><Upload className="h-4 w-4" /> Statement</Button>}
        <Link to={`/accounts/reports?report=cashbook&account=${a._id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-brand-600 hover:underline"><BookOpen className="h-4 w-4" /> Transactions</Link>
      </div>
    </Card>
  );
}

function ChequesInHand({ cheques, loading, onDeposit }: { cheques: ChequeInHand[]; loading: boolean; onDeposit: (c: ChequeInHand[]) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const chosen = cheques.filter((c) => picked.has(c._id));
  const total = chosen.reduce((s, c) => s + c.amount, 0);
  const toggle = (id: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  const due = cheques.filter((c) => c.due);
  return (
    <Card className="p-4" aria-label="Cheques in hand">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Cheques in hand</h3>
        <span className="text-sm text-ink-500">received, not yet in the bank</span>
        <div className="ml-auto flex items-center gap-2">
          {due.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(due.map((c) => c._id)))}>Tick all due ({due.length})</Button>}
          <Button size="sm" disabled={!chosen.length} onClick={() => onDeposit(chosen)}>Deposit {chosen.length ? `${chosen.length} · ₹${money(total)}` : "selected"}</Button>
        </div>
      </div>
      {loading ? <Skeleton className="mt-3 h-16 w-full" /> : cheques.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">None. A cheque received is listed here until it is deposited.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-ink-200 text-left text-xs text-ink-500 font-medium">
              <th className="py-2 pr-2" /><th className="py-2 pr-2 font-medium">Cheque</th><th className="py-2 pr-2 font-medium">From</th><th className="py-2 pr-2 font-medium">Drawn on</th><th className="py-2 pr-2 font-medium">Dated</th><th className="py-2 text-right font-medium">Amount (₹)</th>
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {cheques.map((c) => (
                <tr key={c._id} className={c.due ? "" : "text-ink-400"}>
                  <td className="py-1.5 pr-2"><input type="checkbox" aria-label={`Deposit cheque ${c.chequeNo || c.voucherNo}`} disabled={!c.due} checked={picked.has(c._id)} onChange={(e) => toggle(c._id, e.target.checked)} /></td>
                  <td className="py-1.5 pr-2"><Link to={`/accounts/payments/${c._id}`} className="font-medium text-brand-600 hover:underline">{c.chequeNo || "—"}</Link><span className="block text-xs text-ink-400">{c.voucherNo}</span></td>
                  <td className="py-1.5 pr-2">{c.partyName}</td>
                  <td className="py-1.5 pr-2">{c.bank || "—"}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(c.chequeDate)}{!c.due && <StatusChip tone="neutral" className="ml-1">dated ahead</StatusChip>}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DepositDialog({ cheques, into, accounts, onClose }: { cheques: ChequeInHand[]; into?: string; accounts: BankingAccount[]; onClose: () => void }) {
  const { toast } = useToast();
  const { createDeposit } = useAccountsMutations();
  const banks = accounts.filter((a) => a.kind === "bank" && a.active !== false);
  const boxes = accounts.filter((a) => a.kind === "cash" && a.active !== false);
  const [account, setAccount] = useState(into && banks.some((b) => b._id === into) ? into : banks.find((b) => b.isDefault)?._id ?? banks[0]?._id ?? "");
  const [date, setDate] = useState(today());
  const [bankSlipNo, setBankSlipNo] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set(cheques.map((c) => c._id)));
  const [cash, setCash] = useState<number | "">("");
  const [cashFrom, setCashFrom] = useState(boxes[0]?._id ?? "");
  const box = boxes.find((b) => b._id === cashFrom);
  const chosen = useMemo(() => cheques.filter((c) => picked.has(c._id)), [cheques, picked]);
  const cashValue = Number(cash) || 0;
  const total = chosen.reduce((s, c) => s + c.amount, 0) + cashValue;
  const problem = !banks.length ? "Add a bank account first" : box && cashValue > box.balance + 0.005 ? `${box.name} has only ₹${money(box.balance)}` : "";
  const [done, setDone] = useState<{ id: string; slipNo: string } | null>(null);

  const submit = () => createDeposit.mutate(
    { account, date, cheques: chosen.map((c) => c._id), ...(cashValue > 0 ? { cash: cashValue, cashFrom } : {}), bankSlipNo: bankSlipNo.trim() || undefined },
    { onSuccess: (s) => { toast(`${s.slipNo} · ₹${money(s.total)} deposited`, "success"); setDone({ id: s._id, slipNo: s.slipNo }); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not deposit", "error") },
  );

  if (done) {
    return (
      <Modal open onClose={onClose} title="Deposited" width="max-w-md">
        <p className="text-sm text-ink-600">{done.slipNo} is posted. Print the slip to hand in at the counter, or keep it with the bank's counterfoil.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Done</Button>
          <a href={accountsService.depositPdfUrl(done.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"><Printer className="h-4 w-4" /> Print slip</a>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} title="Deposit into the bank" width="max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Into *" value={account} onChange={(e) => setAccount(e.target.value)} options={banks.map((b) => ({ value: b._id, label: b.name }))} />
        <Input label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Bank's slip no." value={bankSlipNo} onChange={(e) => setBankSlipNo(e.target.value)} placeholder="From the counterfoil" />
      </div>
      <h4 className="mt-4 text-sm font-semibold">Cheques</h4>
      {cheques.length === 0 ? <p className="mt-1 text-sm text-ink-400">No cheque is due to deposit — cash only.</p> : (
        <ul className="mt-1 divide-y divide-ink-100 text-sm" aria-label="Cheques to deposit">
          {cheques.map((c) => (
            <li key={c._id} className="flex items-center gap-2 py-1.5">
              <input type="checkbox" aria-label={`Include cheque ${c.chequeNo || c.voucherNo}`} checked={picked.has(c._id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c._id); else n.delete(c._id); return n; })} />
              <span className="flex-1">{c.chequeNo || c.voucherNo} · {c.partyName}{c.bank ? <span className="text-ink-400"> · {c.bank}</span> : null}</span>
              <span className="tabular-nums">₹{money(c.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {boxes.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input label="Cash too (₹)" type="number" min={0} step="0.01" value={cash} onChange={(e) => setCash(e.target.value === "" ? "" : Number(e.target.value))} hint={box ? `${box.name} holds ₹${money(box.balance)}` : undefined} />
          {boxes.length > 1 && <Select label="From" value={cashFrom} onChange={(e) => setCashFrom(e.target.value)} options={boxes.map((b) => ({ value: b._id, label: b.name }))} />}
        </div>
      )}
      {problem && <p className="mt-2 text-sm text-status-danger">{problem}</p>}
      <div className="mt-4 flex items-center justify-end gap-3">
        <span className="text-sm text-ink-500">{chosen.length} cheque{chosen.length === 1 ? "" : "s"}{cashValue > 0 ? " and cash" : ""} · <span className="font-semibold tabular-nums text-ink-900">₹{money(total)}</span></span>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!account || total <= 0 || !!problem} loading={createDeposit.isPending} onClick={submit}>Deposit ₹{money(total)}</Button>
      </div>
    </Modal>
  );
}

function RecentDeposits() {
  const { data } = useDeposits();
  const slips = data?.slips ?? [];
  if (!slips.length) return null;
  return (
    <Card className="p-4" aria-label="Recent deposits">
      <h3 className="font-semibold">Recent deposits</h3>
      <ul className="mt-2 divide-y divide-ink-100 text-sm">
        {slips.slice(0, 8).map((s) => (
          <li key={s._id} className="flex flex-wrap items-center gap-2 py-1.5">
            <span className="font-medium">{s.slipNo}</span>
            <span className="text-ink-500">{formatDate(s.date)} · {s.accountName} · {s.cheques.length} cheque{s.cheques.length === 1 ? "" : "s"}{s.cash > 0 ? " and cash" : ""}</span>
            <span className="ml-auto tabular-nums">₹{money(s.total)}</span>
            <a href={accountsService.depositPdfUrl(s._id)} target="_blank" rel="noreferrer" aria-label={`Print ${s.slipNo}`} className="text-brand-600 hover:underline"><Printer className="h-4 w-4" /></a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
