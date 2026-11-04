import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Mail, MessageCircle, FileMinus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money, today } from "./shared";
import type { ChequeStatus, ConfirmationRow, ConfirmationStatus, PdcRow } from "./types";

const th = "py-2 text-xs font-medium uppercase tracking-wide text-ink-400";
const num = "py-2 text-right tabular-nums";

// ── Cheques ──────────────────────────────────────────────────────────
const CHEQUE_TONE: Record<ChequeStatus, "neutral" | "warning" | "info" | "success" | "danger"> = { "": "neutral", held: "warning", deposited: "info", cleared: "success", bounced: "danger" };
function BounceForm({ row, onDone, onCancel }: { row: PdcRow; onDone: () => void; onCancel: () => void }) {
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

export function ChequesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"held" | "deposited" | "cleared" | "bounced" | "all">("held");
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "pdc", status], queryFn: () => accountsService.pdc(status) });
  const [bouncing, setBouncing] = useState<PdcRow | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "pdc"] }); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "payments"] }); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "inbox"] }); };
  const act = async (row: PdcRow, action: "deposited" | "cleared") => {
    try { await accountsService.chequeAction(row._id, { action, on: today() }); toast(`Cheque ${row.cheque.number || ""} ${action}`, "success"); refresh(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not update it", "error"); }
  };
  const todayStart = new Date(); todayStart.setHours(23, 59, 59, 999);
  return (
    <div className="space-y-4">
      <Modal open={!!bouncing} onClose={() => setBouncing(null)} title="Cheque returned" width="max-w-lg">{bouncing && <BounceForm row={bouncing} onDone={() => { setBouncing(null); refresh(); }} onCancel={() => setBouncing(null)} />}</Modal>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">Cheques</h3>
            {q.data && <p className="text-sm text-ink-500">In the drawer: {q.data.totals.held.count} cheque{q.data.totals.held.count === 1 ? "" : "s"} · received ₹{money(q.data.totals.held.received)} · issued ₹{money(q.data.totals.held.issued)}{q.data.totals.dueToday.count ? <span className="text-status-warning"> · {q.data.totals.dueToday.count} due to deposit (₹{money(q.data.totals.dueToday.amount)})</span> : null}</p>}
          </div>
          <FilterChips options={[{ value: "held", label: "In hand" }, { value: "deposited", label: "Deposited" }, { value: "cleared", label: "Cleared" }, { value: "bounced", label: "Returned" }, { value: "all", label: "All" }]} value={status} onChange={setStatus} />
        </div>
        <div className="mt-3 overflow-x-auto">
          {q.isLoading || !q.data ? <Skeleton className="h-32 w-full" /> : (
            <table className="w-full text-sm" aria-label="Cheque register">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Cheque date</th><th className={`${th} text-left`}>Cheque</th><th className={`${th} text-left`}>Party</th><th className={`${th} text-left`}>Voucher</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-left pl-3`}>Status</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {q.data.rows.map((r) => {
                  const due = r.cheque.date ? new Date(r.cheque.date) <= todayStart : false;
                  return (
                    <tr key={r._id}>
                      <td className="py-1.5 whitespace-nowrap">{r.cheque.date ? formatDate(r.cheque.date) : "—"}{r.cheque.status === "held" && due && <StatusChip tone="warning" className="ml-1">deposit</StatusChip>}</td>
                      <td className="py-1.5">{r.cheque.number || "—"}<span className="block text-xs text-ink-400">{r.cheque.bank || ""}</span></td>
                      <td className="py-1.5">{r.partyName}<span className="block text-xs text-ink-400">{r.kind === "receipt" ? "received" : "issued"} · {r.accountName || ""}</span></td>
                      <td className="py-1.5"><Link to={`/accounts/payments/${r._id}`} className="text-brand-600 hover:underline">{r.voucherNo}</Link><span className="block text-xs text-ink-400">{(r.allocations ?? []).map((a) => a.docNo).join(", ")}</span></td>
                      <td className={`${num} font-medium`}>{money(r.amount)}</td>
                      <td className="py-1.5 pl-3"><StatusChip tone={CHEQUE_TONE[r.cheque.status]}>{r.cheque.status === "held" ? "in hand" : r.cheque.status}</StatusChip>{r.cheque.status === "bounced" && <span className="block text-xs text-status-danger">{r.cheque.bounceReason}{r.cheque.charges ? ` · charges ₹${money(r.cheque.charges)}` : ""}</span>}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        {r.status === "posted" && r.cheque.status === "held" && <Button size="sm" variant="ghost" onClick={() => act(r, "deposited")}>Deposited</Button>}
                        {r.status === "posted" && (r.cheque.status === "held" || r.cheque.status === "deposited") && <Button size="sm" variant="ghost" onClick={() => act(r, "cleared")}>Cleared</Button>}
                        {r.status === "posted" && (r.cheque.status === "held" || r.cheque.status === "deposited") && <Button size="sm" variant="ghost" onClick={() => setBouncing(r)}>Returned</Button>}
                      </td>
                    </tr>
                  );
                })}
                {q.data.rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={7}>{status === "held" ? "No cheque in hand. A receipt or payment by cheque dated ahead is held here until it is deposited." : "Nothing here."}</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Balance confirmations ────────────────────────────────────────────
const CONF_TONE: Record<ConfirmationStatus | "none", "neutral" | "info" | "warning" | "success" | "danger"> = { none: "neutral", draft: "neutral", sent: "info", confirmed: "success", disputed: "danger" };
function LetterDialog({ row, asOf, onClose, onChanged }: { row: ConfirmationRow; asOf: string; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const c = row.confirmation!;
  const letter = useQuery({ queryKey: [ACCOUNTS_KEY, "confirmation-letter", c._id], queryFn: () => accountsService.confirmationLetter(c._id) });
  const [channel, setChannel] = useState<"email" | "whatsapp" | "print">(row.email ? "email" : row.phone ? "whatsapp" : "print");
  const [to, setTo] = useState(row.email || row.phone || "");
  const [reply, setReply] = useState<"confirmed" | "disputed">("confirmed");
  const [theirs, setTheirs] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await accountsService.sendConfirmation(c._id, { channel, to: channel === "print" ? undefined : to }); toast(channel === "print" ? "Marked as printed" : `Sent by ${channel}`, "success"); onChanged(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not send", "error"); }
    finally { setBusy(false); }
  };
  const record = async () => {
    setBusy(true);
    try { await accountsService.replyConfirmation(c._id, { status: reply, theirBalance: reply === "disputed" ? theirs : undefined, note }); toast(reply === "confirmed" ? "Balance confirmed" : "Difference recorded", "success"); onChanged(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not record it", "error"); }
    finally { setBusy(false); }
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w || !letter.data) return;
    w.document.write(`<pre style="font: 13px/1.5 Georgia, serif; white-space: pre-wrap; max-width: 40em; margin: 2em auto">${letter.data.text.replace(/</g, "&lt;")}</pre>`);
    w.document.close(); w.print();
  };
  return (
    <Modal open onClose={onClose} confirmDirtyClose={false} title={`${c.confirmationNo} · ${row.partyName} · as on ${formatDate(asOf)}`} width="max-w-3xl">
      {letter.isLoading || !letter.data ? <Skeleton className="h-64 w-full" /> : (
        <div className="space-y-4">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 font-serif text-sm" aria-label="Letter">{letter.data.text}</pre>
          <div className="flex flex-wrap items-end gap-2">
            <Select label="Send by" value={channel} onChange={(e) => { const ch = e.target.value as typeof channel; setChannel(ch); setTo(ch === "email" ? row.email : ch === "whatsapp" ? row.phone : ""); }} options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "print", label: "Print and hand over" }]} />
            {channel !== "print" && <Input label={channel === "email" ? "To" : "Phone"} value={to} onChange={(e) => setTo(e.target.value)} className="w-56" />}
            <Button variant="secondary" loading={busy} onClick={send}>{channel === "email" ? <Mail className="h-4 w-4" /> : channel === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : <Printer className="h-4 w-4" />} {c.status === "draft" ? "Send" : "Send again"}</Button>
            <Button variant="ghost" onClick={print}><Printer className="h-4 w-4" /> Print</Button>
          </div>
          {c.sent?.at && <p className="text-xs text-ink-500">Sent {formatDate(c.sent.at)} · {c.sent.result}</p>}
          <div className="border-t border-ink-100 pt-3">
            <p className="text-sm font-medium">Their reply</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Select label="They say" value={reply} onChange={(e) => setReply(e.target.value as typeof reply)} options={[{ value: "confirmed", label: "Agrees with our books" }, { value: "disputed", label: "A different balance" }]} />
              {reply === "disputed" && <Input label="Balance in their books (₹)" type="number" step="0.01" value={theirs} onChange={(e) => setTheirs(e.target.value === "" ? "" : Number(e.target.value))} className="w-44" />}
              <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What makes the difference" className="w-64" />
              <Button loading={busy} disabled={reply === "disputed" && theirs === ""} onClick={record}>Record reply</Button>
            </div>
            {c.reply?.at && <p className="mt-1 text-xs text-ink-500">Replied {formatDate(c.reply.at)}: {c.status}{c.reply.difference ? ` · difference ₹${money(c.reply.difference)}` : ""}{c.reply.note ? ` · ${c.reply.note}` : ""}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ConfirmationsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [asOf, setAsOf] = useState(() => { const d = new Date(); return d.getMonth() >= 3 ? `${d.getFullYear()}-03-31` : `${d.getFullYear() - 1}-03-31`; });
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "confirmations", asOf], queryFn: () => accountsService.confirmations(asOf) });
  const [open, setOpen] = useState<ConfirmationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "confirmations"] });
  const make = async (row?: ConfirmationRow) => {
    setBusy(true);
    try { const r = await accountsService.createConfirmations(row ? { asOf, partyType: row.partyType, parties: [row.party] } : { asOf, all: true }); qc.setQueryData([ACCOUNTS_KEY, "confirmations", asOf], r); toast(`${r.made.length} letter${r.made.length === 1 ? "" : "s"} drafted${r.skipped ? `, ${r.skipped} already there` : ""}`, "success"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not draft them", "error"); }
    finally { setBusy(false); }
  };
  const rows = q.data?.rows ?? [];
  const current = open ? rows.find((r) => r.party === open.party && r.partyType === open.partyType) ?? open : null;
  return (
    <div className="space-y-4">
      {current?.confirmation && <LetterDialog row={current} asOf={asOf} onClose={() => setOpen(null)} onChanged={() => { refresh(); }} />}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">Balance confirmations</h3>
            {q.data && <p className="text-sm text-ink-500">{q.data.totals.parties} parties with a balance · drafted {q.data.totals.draft} · sent {q.data.totals.sent} · confirmed {q.data.totals.confirmed}{q.data.totals.disputed ? <span className="text-status-danger"> · disputed {q.data.totals.disputed}</span> : null} · receivable ₹{money(q.data.totals.customers)} · payable ₹{money(q.data.totals.suppliers)}</p>}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Balances as on" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || asOf)} />
            <Button variant="secondary" loading={busy} disabled={!rows.some((r) => !r.confirmation)} onClick={() => make()}>Draft letters for all</Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          {q.isLoading || !q.data ? <Skeleton className="h-32 w-full" /> : (
            <table className="w-full text-sm" aria-label="Balance confirmations">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Party</th><th className={`${th} text-left`}>Side</th><th className={`${th} text-right`}>Balance in our books</th><th className={`${th} text-left pl-3`}>Status</th><th className={`${th} text-right`}>Their balance</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => {
                  const st = (r.confirmation?.status ?? "none") as ConfirmationStatus | "none";
                  return (
                    <tr key={`${r.partyType}-${r.party}`}>
                      <td className="py-1.5"><span className="font-medium">{r.partyName}</span><span className="block text-xs text-ink-400">{r.gstin || ""}{r.email ? ` · ${r.email}` : r.phone ? ` · ${r.phone}` : ""}</span></td>
                      <td className="py-1.5">{r.partyType === "customer" ? "Receivable" : "Payable"}</td>
                      <td className={`${num} font-medium`}>{money(r.balance)}</td>
                      <td className="py-1.5 pl-3"><StatusChip tone={CONF_TONE[st]}>{st === "none" ? "not drafted" : st}</StatusChip>{r.confirmation?.sent?.at ? <span className="block text-xs text-ink-400">sent {formatDate(r.confirmation.sent.at)}{r.confirmation.sent.channel ? ` by ${r.confirmation.sent.channel}` : ""}</span> : null}</td>
                      <td className={`${num} ${r.confirmation?.reply?.difference ? "text-status-danger" : ""}`}>{r.confirmation?.reply?.theirBalance !== undefined ? money(r.confirmation.reply.theirBalance) : ""}{r.confirmation?.reply?.difference ? <span className="block text-xs">diff ₹{money(r.confirmation.reply.difference)}</span> : null}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">{r.confirmation ? <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>Letter & reply</Button> : <Button size="sm" variant="ghost" loading={busy} onClick={() => make(r)}>Draft letter</Button>}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={6}>Nobody had a balance on that day.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Interest on overdue receivables ──────────────────────────────────
export function InterestSection() {
  const navigate = useNavigate();
  const [asOf, setAsOf] = useState(today());
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "interest", asOf], queryFn: () => accountsService.interest(asOf) });
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">Interest on overdue invoices</h3>
            <p className="text-sm text-ink-500">Simple interest from the day after the due date on what each invoice still owes{q.data ? `, at ${q.data.settings.rate}% a year${q.data.settings.graceDays ? ` after ${q.data.settings.graceDays} days' grace` : ""} (a customer's own rate wins)` : ""}. A debit note charges it; the next one starts where the last stopped.</p>
          </div>
          <Input label="As on" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || today())} />
        </div>
        {q.data && !q.data.settings.rate && <p className="mt-2 text-sm text-status-warning">No rate is set: give one under Settings → Books (interest on overdue), or on the customer.</p>}
      </Card>
      {q.isLoading || !q.data ? <Skeleton className="h-48 w-full" /> : q.data.groups.length === 0 ? (
        <Card className="p-5 text-sm text-ink-400">Nothing to charge on {formatDate(asOf)}.</Card>
      ) : q.data.groups.map((g) => (
        <Card key={g.party} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h4 className="font-semibold">{g.partyName}</h4><p className="text-sm text-ink-500">₹{money(g.outstanding)} overdue · {g.rate}% a year · interest ₹{money(g.total)}</p></div>
            <Button variant="secondary" onClick={() => navigate(`/accounts/notes?new=debit-customer&interest=${g.party}&asOf=${asOf}`)}><FileMinus className="h-4 w-4" /> Raise debit note</Button>
          </div>
          <table className="mt-2 w-full text-sm" aria-label={`Interest for ${g.partyName}`}>
            <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Invoice</th><th className={`${th} text-left`}>Due</th><th className={`${th} text-right`}>Outstanding</th><th className={`${th} text-left pl-3`}>Period</th><th className={`${th} text-right`}>Days</th><th className={`${th} text-right`}>Interest</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {g.rows.map((r) => <tr key={r.invoice}><td className="py-1.5"><Link to={`/invoices/${r.invoice}`} className="text-brand-600 hover:underline">{r.docNo}</Link></td><td className="py-1.5">{formatDate(r.dueDate)} <span className="text-xs text-ink-400">({r.overdueDays}d)</span></td><td className={num}>{money(r.outstanding)}</td><td className="py-1.5 pl-3 text-xs text-ink-500">{formatDate(r.from)} – {formatDate(r.to)}{r.chargedTo ? ` · charged to ${formatDate(r.chargedTo)}` : ""}</td><td className={num}>{r.days}</td><td className={`${num} font-medium`}>{money(r.interest)}</td></tr>)}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
