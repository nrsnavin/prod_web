import { useState } from "react";
import { Check, Landmark, RotateCcw, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useBankAccounts } from "./hooks";
import { money, today } from "./shared";
import type { ChequeDetails, ChequeStatus, VoucherKind } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A CHEQUE, STAGE BY STAGE
//
//  received (in hand) → deposited (with the bank, on a day, into an
//  account) → cleared (the bank credited it) — or returned, which
//  cancels the voucher. Each step asks for its date (and the deposit
//  for the bank), and the same card and buttons serve the cheque
//  register and the voucher's own page. A cheque issued runs the same
//  way from our side: held until its date, out with the party, cleared.
// ══════════════════════════════════════════════════════════════════

/** The least a row needs for the stage buttons. */
export interface ChequeRow { _id: string; kind: VoucherKind; voucherNo: string; date: string; partyName: string; amount: number; account?: string; accountName?: string; cheque: ChequeDetails; status: "posted" | "cancelled" }

export const CHEQUE_TONE: Record<ChequeStatus, "neutral" | "warning" | "info" | "success" | "danger"> = { "": "neutral", held: "warning", deposited: "info", cleared: "success", bounced: "danger" };

/** The stage in words, from our side of the counter. */
export function chequeStageLabel(status: ChequeStatus, kind: VoucherKind): string {
  if (status === "held") return kind === "receipt" ? "received, in hand" : "held, not yet presented";
  if (status === "deposited") return kind === "receipt" ? "deposited" : "issued";
  if (status === "cleared") return "cleared";
  if (status === "bounced") return "returned";
  return "—";
}

/** The three steps, with the day each happened. */
export function ChequeTimeline({ row }: { row: ChequeRow }) {
  const c = row.cheque;
  const rank: Record<ChequeStatus, number> = { "": 0, held: 1, deposited: 2, cleared: 3, bounced: 2 };
  const at = rank[c.status];
  const steps = [
    { key: "received", label: row.kind === "receipt" ? "Received" : "Written", on: c.receivedOn || row.date, done: at >= 1 },
    { key: "deposited", label: row.kind === "receipt" ? "Deposited" : "Handed over", on: c.depositedOn, done: at >= 2 },
    { key: "cleared", label: "Cleared", on: c.clearedOn, done: at >= 3 },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Cheque stages">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${s.done ? "bg-status-successBg text-status-success" : "bg-ink-100 text-ink-400"}`}>
            {s.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span className="h-3.5 w-3.5 rounded-full border border-ink-300" aria-hidden />}
            {s.label}{s.done && s.on ? <span className="text-xs opacity-80"> · {formatDate(s.on)}</span> : null}
          </span>
          {i < steps.length - 1 && <span className="text-ink-300" aria-hidden>→</span>}
        </li>
      ))}
      {c.status === "bounced" && <li><StatusChip tone="danger">Returned{c.bouncedOn ? ` · ${formatDate(c.bouncedOn)}` : ""}{c.bounceReason ? ` · ${c.bounceReason}` : ""}{c.charges ? ` · charges ₹${money(c.charges)}` : ""}</StatusChip></li>}
    </ol>
  );
}

/** Deposit (date and bank) or mark cleared (date). */
function StageForm({ row, action, onDone, onCancel }: { row: ChequeRow; action: "deposited" | "cleared"; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const { data: accounts } = useBankAccounts();
  const [on, setOn] = useState(today());
  const [account, setAccount] = useState(row.account || "");
  const [busy, setBusy] = useState(false);
  const banks = (accounts ?? []).filter((a) => a.active !== false && a.kind !== "cash");
  const chosen = account || banks.find((a) => a.isDefault)?._id || banks[0]?._id || "";
  const deposit = action === "deposited";
  const save = async () => {
    setBusy(true);
    try {
      await accountsService.chequeAction(row._id, { action, on, ...(chosen && chosen !== row.account ? { account: chosen } : {}) });
      toast(deposit ? `Cheque ${row.cheque.number || ""} deposited` : `Cheque ${row.cheque.number || ""} cleared`, "success");
      onDone();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not update it", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        {deposit
          ? `Cheque ${row.cheque.number || ""} for ₹${money(row.amount)} from ${row.partyName}: handed to the bank. It shows as cleared once the bank credits it — tick it then, or let the bank statement do it.`
          : `Cheque ${row.cheque.number || ""} for ₹${money(row.amount)}: the bank has ${row.kind === "receipt" ? "credited" : "debited"} it. The day goes on the voucher for the reconciliation.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={deposit ? "Deposited on" : "Cleared on"} type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        {(deposit || row.cheque.status === "held") && (
          <Select label={row.kind === "receipt" ? "Into account" : "From account"} value={chosen} onChange={(e) => setAccount(e.target.value)} options={banks.map((a) => ({ value: a._id, label: a.name }))} placeholder="Pick the bank" />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Back</Button>
        <Button loading={busy} disabled={!on || (deposit && !chosen)} onClick={save}>{deposit ? "Mark deposited" : "Mark cleared"}</Button>
      </div>
    </div>
  );
}

function BounceForm({ row, onDone, onCancel }: { row: ChequeRow; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [on, setOn] = useState(today());
  const [reason, setReason] = useState("");
  const [charges, setCharges] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await accountsService.chequeAction(row._id, { action: "bounced", on, reason, charges: Number(charges) || 0 }); toast(`${row.voucherNo} cancelled — cheque ${row.cheque.number || ""} returned`, "success"); onDone(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not record it", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">The {row.kind} {row.voucherNo} for ₹{money(row.amount)} is cancelled: what it settled is open again on {row.partyName}'s account.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Returned on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        <Input label="Bank's charges (₹)" type="number" min={0} value={charges} onChange={(e) => setCharges(e.target.value === "" ? "" : Number(e.target.value))} />
        <Input label="Reason on the memo *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Funds insufficient, signature differs…" className="sm:col-span-2" />
      </div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Back</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={busy} onClick={save}>Record the return</Button></div>
    </div>
  );
}

/** The buttons a cheque at this stage can take, each opening its step. */
export function ChequeActions({ row, onDone, size = "sm" }: { row: ChequeRow; onDone?: () => void; size?: "sm" | "md" }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"deposited" | "cleared" | "bounced" | null>(null);
  const live = row.status === "posted";
  const s = row.cheque.status;
  const done = () => {
    setStep(null);
    qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
    onDone?.();
  };
  if (!live || s === "cleared" || s === "bounced" || !s) return null;
  const titles = { deposited: row.kind === "receipt" ? "Deposit the cheque" : "Cheque handed over", cleared: "Cheque cleared", bounced: "Cheque returned" };
  return (
    <>
      {s === "held" && <Button size={size} variant={size === "md" ? "primary" : "ghost"} onClick={() => setStep("deposited")}><Landmark className="h-4 w-4" /> {row.kind === "receipt" ? "Deposit" : "Handed over"}</Button>}
      <Button size={size} variant={size === "md" ? "secondary" : "ghost"} onClick={() => setStep("cleared")}><Check className="h-4 w-4" /> Cleared</Button>
      <Button size={size} variant="ghost" onClick={() => setStep("bounced")}><RotateCcw className="h-4 w-4" /> Returned</Button>
      <Modal open={!!step} onClose={() => setStep(null)} title={step ? titles[step] : ""} width="max-w-lg">
        {step === "bounced" ? <BounceForm row={row} onDone={done} onCancel={() => setStep(null)} /> : step ? <StageForm row={row} action={step} onDone={done} onCancel={() => setStep(null)} /> : null}
      </Modal>
    </>
  );
}

/** On the voucher's own page: the cheque, where it stands, and what to do next. */
export function ChequeCard({ row }: { row: ChequeRow }) {
  const c = row.cheque;
  const next = row.status !== "posted" ? null
    : c.status === "held" ? (row.kind === "receipt" ? "Next: deposit it at the bank, then mark it cleared when the bank credits it." : "Next: once it is presented and debited, mark it cleared.")
    : c.status === "deposited" ? "Next: mark it cleared when the bank credits it, or returned if it comes back." : null;
  return (
    <Card className="mt-4 p-5" aria-label="Cheque">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-brand-500" /> Cheque {c.number || ""}</h3>
        <span className="text-sm text-ink-500">{c.bank ? `${c.bank} · ` : ""}{c.date ? `dated ${formatDate(c.date)} · ` : ""}{row.kind === "receipt" ? "into" : "from"} {row.accountName || "—"}</span>
        <StatusChip tone={CHEQUE_TONE[c.status]}>{chequeStageLabel(c.status, row.kind)}</StatusChip>
      </div>
      <div className="mt-3"><ChequeTimeline row={row} /></div>
      {next && <p className="mt-2 text-sm text-ink-500">{next}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><ChequeActions row={row} size="md" /></div>
    </Card>
  );
}
