import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageSquareText, Send, Copy, Phone } from "lucide-react";
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
import { money } from "./shared";
import type { CollectionEntry } from "./types";

function ReminderDialog({ entry, whatsapp, onClose }: { entry: CollectionEntry; whatsapp: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [tone, setTone] = useState<"gentle" | "firm">("gentle");
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
      const r = await accountsService.sendReminder(to, message);
      if (r.sent) toast(`Sent to ${r.to}`, "success");
      else if (r.dryRun) toast("WhatsApp is not connected on the server — copy the message instead", "info");
      else toast(r.error || "Could not send", "error");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not send", "error"); } finally { setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} title={`Remind ${entry.partyName}`} width="max-w-2xl" confirmDirtyClose={false}>
      <div className="space-y-3">
        <p className="text-sm text-ink-500">₹{money(entry.overdue)} overdue on {entry.docs.length} invoice{entry.docs.length === 1 ? "" : "s"}, the oldest {entry.oldestDays} days past due. {entry.contact.name ? `Contact ${entry.contact.name}` : ""}{entry.contact.accountant ? ` · accounts ${entry.contact.accountant}` : ""}</p>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" variant={tone === "gentle" ? "primary" : "secondary"} onClick={() => { setTone("gentle"); draft("gentle"); }} loading={busy === "draft" && tone === "gentle"}>Draft a gentle reminder</Button>
          <Button size="sm" variant={tone === "firm" ? "primary" : "secondary"} onClick={() => { setTone("firm"); draft("firm"); }} loading={busy === "draft" && tone === "firm"}>Draft a firm one</Button>
          {byModel !== null && <span className="text-xs text-ink-400">{byModel ? "Written by the model from the invoice list — read it before sending." : "From the template (no AI key on the server)."}</span>}
        </div>
        <textarea aria-label="Reminder message" rows={9} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Draft a reminder, or write your own." className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
        <div className="flex flex-wrap items-end gap-2">
          <Input label="WhatsApp number" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(message); toast("Copied", "success"); }} disabled={!message}><Copy className="h-4 w-4" /> Copy</Button>
          <Button onClick={send} disabled={!message || message.length < 20 || !to} loading={busy === "send"} title={whatsapp ? undefined : "WhatsApp is not connected on the server"}><Send className="h-4 w-4" /> Send on WhatsApp</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Who to chase, biggest and oldest first, and the reminder drafted for each. */
export function CollectionsTab() {
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "collections"], queryFn: accountsService.collections });
  const [open, setOpen] = useState<CollectionEntry | null>(null);
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  const rows = data?.rows ?? [];
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Overdue collections</h3>
          <p className="text-sm text-ink-500">₹{money(data?.total ?? 0)} past due across {rows.length} customer{rows.length === 1 ? "" : "s"} · ranked by amount × days</p>
        </div>
        {rows.length === 0 ? <p className="mt-3 text-sm text-ink-400">Nothing is past due. 🎉</p> : (
          <ul className="mt-3 divide-y divide-ink-100">
            {rows.map((r) => (
              <li key={r.party} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium"><Link to={`/accounts/statements?partyType=customer&party=${r.party}`} className="text-brand-600 hover:underline">{r.partyName}</Link>
                    <StatusChip tone={r.oldestDays > 60 ? "danger" : "warning"} className="ml-2">{r.oldestDays}d</StatusChip></p>
                  <p className="text-xs text-ink-400">{r.docs.map((d) => `${d.docNo} ₹${money(d.outstanding)} (${formatDate(d.dueDate)})`).join(" · ")}</p>
                  <p className="text-xs text-ink-400">{[r.contact.name, r.contact.phone && <span key="p" className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.contact.phone}</span>, r.contact.accountant].filter(Boolean).map((x, i) => <span key={i} className="mr-2">{x}</span>)}</p>
                </div>
                <span className="tabular-nums font-semibold text-status-danger">₹{money(r.overdue)}</span>
                <Button size="sm" variant="secondary" onClick={() => setOpen(r)}><MessageSquareText className="h-4 w-4" /> Remind</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && <ReminderDialog entry={open} whatsapp={!!data?.whatsapp} onClose={() => setOpen(null)} />}
    </div>
  );
}
