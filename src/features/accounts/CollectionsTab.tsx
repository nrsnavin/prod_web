import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageSquareText, Send, Copy, Phone, Handshake, PhoneCall, History, CalendarClock } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money, today } from "./shared";
import type { CollectionEntry } from "./types";

function ReminderDialog({ entry, whatsapp, onClose }: { entry: CollectionEntry; whatsapp: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tone, setTone] = useState<"gentle" | "firm">(entry.next?.tone ?? "gentle");
  const [message, setMessage] = useState("");
  const [to, setTo] = useState(entry.contact.accountantPhone || entry.contact.phone);
  const [byModel, setByModel] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);

  const draft = async (t = tone) => {
    setBusy("draft");
    try {
      const r = await accountsService.draftReminder(entry.party, t);
      setMessage(r.message);
      setByModel(r.byModel);
      if (r.to) setTo(r.to);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not draft", "error"); } finally { setBusy(null); }
  };
  const send = async () => {
    setBusy("send");
    try {
      const r = await accountsService.sendReminder(to, message, { customer: entry.party, tone });
      if (r.sent) toast(`Sent to ${r.to}`, "success");
      else if (r.dryRun) toast("WhatsApp is not connected on the server — logged; copy the message instead", "info");
      else toast(r.error || "Could not send", "error");
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "collections"] });
      onClose();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not send", "error"); } finally { setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} title={`Remind ${entry.partyName}`} width="max-w-2xl" confirmDirtyClose={false}>
      <div className="space-y-3">
        <p className="text-sm text-ink-500">₹{money(entry.overdue)} overdue on {entry.docs.length} invoice{entry.docs.length === 1 ? "" : "s"}, the oldest {entry.oldestDays} days past due. {entry.contact.name ? `Contact ${entry.contact.name}` : ""}{entry.contact.accountant ? ` · accounts ${entry.contact.accountant}` : ""}</p>
        {entry.promise?.broken && <p className="text-sm text-status-danger">They promised ₹{money(entry.promise.amount)} by {formatDate(entry.promise.date)} and it has not come.</p>}
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" variant={tone === "gentle" ? "primary" : "secondary"} onClick={() => { setTone("gentle"); draft("gentle"); }} loading={busy === "draft" && tone === "gentle"}>Draft a gentle reminder</Button>
          <Button size="sm" variant={tone === "firm" ? "primary" : "secondary"} onClick={() => { setTone("firm"); draft("firm"); }} loading={busy === "draft" && tone === "firm"}>Draft a firm one</Button>
          {byModel !== null && <span className="text-xs text-ink-400">{byModel ? "Written by the model from the invoice list — read it before sending." : "From the template (no AI key on the server)."}</span>}
        </div>
        <textarea aria-label="Reminder message" rows={9} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Draft a reminder, or write your own." className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
        <div className="flex flex-wrap items-end gap-2">
          <Input label="WhatsApp number" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(message).catch(() => {}); toast("Copied", "success"); }} disabled={!message}><Copy className="h-4 w-4" /> Copy</Button>
          <Button onClick={send} disabled={!message || message.length < 20 || !to} loading={busy === "send"} title={whatsapp ? undefined : "WhatsApp is not connected on the server"}><Send className="h-4 w-4" /> Send on WhatsApp</Button>
        </div>
      </div>
    </Modal>
  );
}

/** A call made or a promise to pay, written down so tomorrow's list knows. */
export function LogDialog({ entry, kind, onClose }: { entry: CollectionEntry; kind: "call" | "promise"; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [promiseDate, setPromiseDate] = useState(today());
  const [promiseAmount, setPromiseAmount] = useState<number | "">(entry.overdue);
  const [busy, setBusy] = useState(false);
  const ok = kind === "promise" ? !!promiseDate : note.trim().length >= 3;
  const save = async () => {
    setBusy(true);
    try {
      await accountsService.logCollection({ customer: entry.party, kind, note: note.trim() || undefined, ...(kind === "promise" ? { promiseDate, promiseAmount: Number(promiseAmount) || 0 } : { channel: "phone" }) });
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "collections"] });
      toast(kind === "promise" ? "Promise noted — they are off the list until then" : "Call noted", "success");
      onClose();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={kind === "promise" ? `${entry.partyName} promised to pay` : `Called ${entry.partyName}`} width="max-w-md">
      <div className="space-y-3">
        {kind === "promise" && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="By *" type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
            <Input label="Amount" type="number" min={0} value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
        )}
        <Input label={kind === "promise" ? "Note" : "What they said *"} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "promise" ? "e.g. Accountant will pay by NEFT" : "e.g. Payment held for their bank limit"} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!ok} loading={busy}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function HistoryDialog({ entry, onClose }: { entry: CollectionEntry; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "collection-history", entry.party], queryFn: () => accountsService.collectionHistory(entry.party) });
  return (
    <Modal open onClose={onClose} title={`Contact with ${entry.partyName}`} width="max-w-xl">
      {isLoading ? <Skeleton className="h-32 w-full" /> : !data?.length ? <p className="text-sm text-ink-400">No contact noted yet.</p> : (
        <ul className="divide-y divide-ink-100 text-sm">
          {data.map((h) => (
            <li key={h._id} className="py-2">
              <p><span className="font-medium capitalize">{h.kind === "reply" ? "Their reply" : h.kind}</span>{h.channel ? <span className="text-ink-400"> · {h.channel}</span> : null}<span className="text-ink-400"> · {formatDate(h.createdAt)}{h.byName ? ` · ${h.byName}` : ""}</span>{h.result ? <StatusChip tone={h.result === "sent" ? "success" : "neutral"} className="ml-2">{h.result}</StatusChip> : null}</p>
              {h.kind === "promise" && h.promiseDate && <p className="text-ink-600">₹{money(h.promiseAmount)} by {formatDate(h.promiseDate)}</p>}
              {h.kind === "reply" && h.message && <p className="whitespace-pre-wrap rounded bg-ink-50 px-2 py-1 text-ink-700">“{h.message}”</p>}
              {h.note && <p className="text-ink-600">{h.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/**
 * Who to chase, biggest and oldest first, and what to do next for each:
 * a gentle reminder, a firm one at three weeks past due, a phone call past
 * six. A live promise takes a customer off the list until its date.
 */
export function CollectionsTab() {
  const [showHeld, setShowHeld] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "collections", showHeld], queryFn: () => accountsService.collections(showHeld) });
  const [open, setOpen] = useState<{ entry: CollectionEntry; what: "remind" | "call" | "promise" | "history" } | null>(null);
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const rows = data?.rows ?? [];
  return (
    <div className="space-y-4">
      <ScheduledReminders />
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Overdue collections</h3>
          <p className="text-sm text-ink-500">₹{money(data?.total ?? 0)} past due across {rows.length} customer{rows.length === 1 ? "" : "s"} · ranked by amount × days</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showHeld} onChange={(e) => setShowHeld(e.target.checked)} /> Show customers with a promise</label>
        </div>
        {rows.length === 0 ? <p className="mt-3 text-sm text-ink-400">Nothing to chase right now.</p> : (
          <ul className="mt-3 divide-y divide-ink-100">
            {rows.map((r) => (
              <li key={r.party} className={`flex flex-wrap items-center gap-3 py-3 ${r.held ? "opacity-70" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium"><Link to={`/accounts/statements?partyType=customer&party=${r.party}`} className="text-brand-600 hover:underline">{r.partyName}</Link>
                    <StatusChip tone={r.oldestDays > 60 ? "danger" : "warning"} className="ml-2">{r.oldestDays}d</StatusChip>
                    {r.held && r.promise && <StatusChip tone="info" className="ml-2">promised by {formatDate(r.promise.date)}</StatusChip>}
                    {!r.held && r.promise?.broken && <StatusChip tone="danger" className="ml-2">promise broken</StatusChip>}
                    {(r.onAccount ?? 0) > 0 && <StatusChip tone={r.covered ? "success" : "info"} className="ml-2">₹{money(r.onAccount ?? 0)} on account</StatusChip>}
                  </p>
                  <p className="text-xs text-ink-400">{r.docs.map((d) => `${d.docNo} ₹${money(d.outstanding)} (${formatDate(d.dueDate)})`).join(" · ")}</p>
                  <p className="text-xs text-ink-400">{[r.contact.name, r.contact.phone && <span key="p" className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.contact.phone}</span>, r.contact.accountant].filter(Boolean).map((x, i) => <span key={i} className="mr-2">{x}</span>)}</p>
                  <p className="text-xs">
                    {r.lastContact ? <span className="text-ink-500">Last: {r.lastContact.kind}{r.lastContact.channel ? ` (${r.lastContact.channel})` : ""} {formatDate(r.lastContact.at)}{r.lastContact.byName ? ` by ${r.lastContact.byName}` : ""}</span> : <span className="text-ink-400">Not contacted yet</span>}
                    {r.next && !r.held && <span className={`ml-2 font-medium ${r.recentlyContacted ? "text-ink-400" : r.next.action === "apply" ? "text-status-success" : r.next.action !== "remind" ? "text-status-danger" : "text-status-warning"}`}>Next: {r.recentlyContacted && r.next.action !== "apply" ? "give them the week" : r.next.action === "apply" ? <Link to={`/accounts/statements?partyType=customer&party=${r.party}`} className="underline">{r.next.label}</Link> : r.next.label}</span>}
                  </p>
                </div>
                <span className="tabular-nums font-semibold text-status-danger">₹{money(r.overdue)}</span>
                <span className="flex flex-wrap gap-1">
                  <Button size="sm" variant={r.next?.action === "remind" && !r.recentlyContacted ? "primary" : "secondary"} onClick={() => setOpen({ entry: r, what: "remind" })}><MessageSquareText className="h-4 w-4" /> Remind</Button>
                  <Button size="sm" variant={(r.next?.action === "call" || r.next?.action === "escalate") && !r.recentlyContacted ? "primary" : "secondary"} onClick={() => setOpen({ entry: r, what: "call" })}><PhoneCall className="h-4 w-4" /> Called</Button>
                  <Button size="sm" variant="secondary" onClick={() => setOpen({ entry: r, what: "promise" })}><Handshake className="h-4 w-4" /> Promised</Button>
                  <Button size="sm" variant="ghost" aria-label={`History with ${r.partyName}`} onClick={() => setOpen({ entry: r, what: "history" })}><History className="h-4 w-4" /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open?.what === "remind" && <ReminderDialog entry={open.entry} whatsapp={!!data?.whatsapp} onClose={() => setOpen(null)} />}
      {(open?.what === "call" || open?.what === "promise") && <LogDialog entry={open.entry} kind={open.what} onClose={() => setOpen(null)} />}
      {open?.what === "history" && <HistoryDialog entry={open.entry} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * Reminders sent on WhatsApp each day at the set hour, to whoever is due
 * one (services/collectionReminders.js), and whether a customer who
 * replies gets an acknowledgement. Off until an admin turns them on;
 * shows who today's run would remind and why the rest are left.
 */
function ScheduledReminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const { data } = useQuery({ queryKey: [ACCOUNTS_KEY, "auto-remind"], queryFn: accountsService.autoRemind });
  const [hour, setHour] = useState<string | null>(null);
  const [every, setEvery] = useState<string | null>(null);
  const [minDays, setMinDays] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWho, setShowWho] = useState(false);
  if (!data) return null;
  const st = data.settings;
  const save = async (collections: Record<string, unknown>) => {
    setBusy(true);
    try {
      await accountsService.saveCollectionSettings(collections);
      setHour(null); setEvery(null); setMinDays(null);
      await qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "auto-remind"] });
      toast("Saved", "success");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "error"); }
    finally { setBusy(false); }
  };
  const runNow = async () => {
    setBusy(true);
    try {
      const r = await accountsService.runAutoRemind();
      toast(r.why === "sent today already" ? "Today's reminders have gone already" : r.why === "off" ? "Scheduled reminders are off" : `${r.sent ?? 0} reminder${r.sent === 1 ? "" : "s"} sent`, r.sent ? "success" : "info");
      await qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not send", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Card className="p-5" aria-label="Reminders on a schedule">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarClock className="h-4 w-4 text-ink-400" aria-hidden />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={!!st.enabled} disabled={!isAdmin || busy} onChange={(e) => save({ autoRemind: { enabled: e.target.checked } })} aria-label="Send reminders on a schedule" />
          Send payment reminders on WhatsApp each day
        </label>
        <StatusChip tone={st.enabled ? "success" : "neutral"}>{st.enabled ? "on" : "off"}</StatusChip>
        {!data.whatsapp && <span className="text-xs text-status-warning">WhatsApp is not set up — reminders are only logged</span>}
      </div>
      <p className="mt-1 text-xs text-ink-400">
        At {String(st.hour ?? 11).padStart(2, "0")}:00, to each customer {st.minOverdueDays ?? 3}+ days past due — not one who promised a date, not one contacted in the last {st.everyDays ?? 7} days, and not one old enough to need a call. Today: {data.send.length} to remind{data.more ? ` (+${data.more} tomorrow)` : ""}, {data.skip.length} left.{" "}
        <button type="button" className="font-medium text-brand-600" onClick={() => setShowWho((x) => !x)}>{showWho ? "Hide" : "Who"}</button>
      </p>
      {showWho && (
        <ul className="mt-2 space-y-1 text-sm" aria-label="Today's reminders">
          {data.send.map((r) => <li key={r.party}>{r.partyName} · ₹{money(r.overdue)} · {r.oldestDays} days · {r.tone}</li>)}
          {data.skip.map((r) => <li key={r.party} className="text-ink-400">{r.partyName} — {r.why}</li>)}
        </ul>
      )}
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!st.acknowledgeReplies} disabled={!isAdmin || busy} onChange={(e) => save({ acknowledgeReplies: e.target.checked })} aria-label="Acknowledge replies" />
        Thank a customer who replies on WhatsApp (their reply is kept, and a promise noted, either way)
      </label>
      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input label="At (hour)" type="number" min={0} max={23} className="w-24" value={hour ?? String(st.hour ?? 11)} onChange={(e) => setHour(e.target.value)} />
          <Input label="Not again within (days)" type="number" min={1} max={60} className="w-40" value={every ?? String(st.everyDays ?? 7)} onChange={(e) => setEvery(e.target.value)} />
          <Input label="Past due at least (days)" type="number" min={0} max={365} className="w-40" value={minDays ?? String(st.minOverdueDays ?? 3)} onChange={(e) => setMinDays(e.target.value)} />
          <Button size="sm" variant="secondary" loading={busy} disabled={hour === null && every === null && minDays === null}
            onClick={() => save({ autoRemind: { ...(hour !== null ? { hour: Number(hour) } : {}), ...(every !== null ? { everyDays: Number(every) } : {}), ...(minDays !== null ? { minOverdueDays: Number(minDays) } : {}) } })}>Save</Button>
          {st.enabled && <Button size="sm" variant="ghost" loading={busy} onClick={runNow}>Send today's now</Button>}
        </div>
      )}
    </Card>
  );
}
