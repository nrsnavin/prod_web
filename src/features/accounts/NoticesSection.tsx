import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileWarning, Plus, Upload } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { httpClient } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { money } from "./shared";

// ══════════════════════════════════════════════════════════════════
//  Notices from GST, income tax, TDS, PF, ESI: read from the PDF, kept
//  with the date to reply, soonest first. A reminder goes on WhatsApp
//  7, 3 and 1 day before, on the day, and once it has passed.
// ══════════════════════════════════════════════════════════════════

type Authority = "gst" | "income_tax" | "tds" | "pf" | "esi" | "professional_tax" | "other";
export interface Notice {
  _id: string; authority: Authority; form: string; reference: string; subject: string; periodText: string; financialYear?: string;
  amount?: number | null; issuedOn?: string; replyBy?: string; replyByAssumed?: boolean; hearingOn?: string; summary: string; documents: string[];
  owner?: string; status: "open" | "replied" | "closed"; repliedOn?: string; replyRef?: string;
  daysLeft: number | null; urgency: "overdue" | "urgent" | "soon" | "later" | "none";
  attachments?: { _id: string; filename: string }[];
}
interface NoticeRead {
  read: { problem: null | "not_a_notice" | "unreadable"; authority?: Authority; form?: string; reference?: string; subject?: string; periodText?: string; financialYear?: string; amount?: number | null; issuedOn?: string; replyBy?: string; replyByAssumed?: boolean; hearingOn?: string; summary?: string; documents?: string[] };
  already: { form: string; reference: string; status: string } | null;
  aiSuggestion: string | null;
}

const AUTHORITY: Record<Authority, string> = { gst: "GST", income_tax: "Income tax", tds: "TDS", pf: "PF", esi: "ESI", professional_tax: "Professional tax", other: "Other" };
const KEY = ["accounts", "notices"];

function dueText(n: Notice) {
  if (n.status !== "open") return n.status === "replied" ? `Replied${n.replyRef ? ` · ${n.replyRef}` : ""}` : "Closed";
  if (n.daysLeft == null) return "No reply date";
  if (n.daysLeft < 0) return `${-n.daysLeft} day${n.daysLeft === -1 ? "" : "s"} overdue`;
  if (n.daysLeft === 0) return "Reply due today";
  return `${n.daysLeft} day${n.daysLeft === 1 ? "" : "s"} left`;
}
const TONE = { overdue: "danger", urgent: "danger", soon: "warning", later: "neutral", none: "neutral" } as const;

export function NoticesSection() {
  const [adding, setAdding] = useState(false);
  const [replying, setReplying] = useState<Notice | null>(null);
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: () => httpClient.get<{ data: Notice[]; counts: { open: number; overdue: number; dueThisWeek: number } }>("/accounts/notices") });
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink-800">Government notices</h3>
          <p className="text-sm text-ink-500">GST, income tax, TDS, PF and ESI notices with their reply date. Reminders go on WhatsApp 7, 3 and 1 day before.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add a notice</Button>
      </div>
      {data && data.counts.open > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <StatusChip tone="neutral">{data.counts.open} open</StatusChip>
          {data.counts.overdue > 0 && <StatusChip tone="danger">{data.counts.overdue} overdue</StatusChip>}
          {data.counts.dueThisWeek > 0 && <StatusChip tone="warning">{data.counts.dueThisWeek} due this week</StatusChip>}
        </div>
      )}
      {isLoading ? <Skeleton className="h-24" /> : !data?.data.length ? (
        <p className="py-6 text-center text-sm text-ink-500">No notices. When one comes, attach its PDF and the reply date is tracked from there.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.data.map((n) => (
            <li key={n._id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium text-ink-800">{AUTHORITY[n.authority]} · {n.form || n.subject}{n.reference ? <span className="text-ink-400"> · {n.reference}</span> : null}</p>
                <p className="text-sm text-ink-600">{[n.form ? n.subject : "", n.periodText, n.amount ? money(n.amount) : ""].filter(Boolean).join(" · ")}</p>
                {n.summary && <p className="text-sm text-ink-500">{n.summary}</p>}
                {n.status === "open" && n.documents.length > 0 && <p className="text-xs text-ink-500">Needs: {n.documents.join("; ")}</p>}
                {n.attachments?.map((a) => <a key={a._id} className="mr-3 text-xs text-brand-600 underline" href={`/api/v2/accounts/notices/${n._id}/attachments/${a._id}`} target="_blank" rel="noreferrer">{a.filename || "notice"}</a>)}
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusChip tone={n.status === "open" ? TONE[n.urgency] : "success"}>{dueText(n)}</StatusChip>
                {n.status === "open" && n.replyBy && <span className="text-xs text-ink-500">by {formatDate(n.replyBy)}{n.replyByAssumed ? " (legal limit — confirm)" : ""}</span>}
                {n.status === "open" && <Button size="sm" variant="secondary" onClick={() => setReplying(n)}>Mark replied</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddNotice onClose={() => setAdding(false)} />}
      {replying && <ReplyNotice notice={replying} onClose={() => setReplying(null)} />}
    </Card>
  );
}

function AddNotice({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<NoticeRead | null>(null);
  const [f, setF] = useState({ authority: "gst" as Authority, form: "", reference: "", subject: "", periodText: "", amount: "" as number | "", issuedOn: "", replyBy: "", replyByAssumed: false, summary: "", documents: [] as string[], owner: "" });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const readIt = async (list: FileList | null) => {
    const picked = Array.from(list ?? []).slice(0, 4);
    if (!picked.length) return;
    setFiles(picked);
    setReading(true);
    try {
      const fd = new FormData();
      picked.forEach((p) => fd.append("files", p));
      const res = await fetch("/api/v2/accounts/notices/read", { method: "POST", body: fd, credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as NoticeRead & { message?: string };
      if (!res.ok) throw new Error(body.message || "Could not read the notice");
      setRead(body);
      if (body.read.problem) { toast(body.read.problem === "not_a_notice" ? "That does not look like a government notice — type it in" : "The notice could not be read — type it in", "info"); return; }
      const r = body.read;
      setF((x) => ({ ...x, authority: r.authority ?? x.authority, form: r.form ?? "", reference: r.reference ?? "", subject: r.subject ?? "", periodText: r.periodText ?? "", amount: r.amount ?? "", issuedOn: r.issuedOn ?? "", replyBy: r.replyBy ?? "", replyByAssumed: !!r.replyByAssumed, summary: r.summary ?? "", documents: r.documents ?? [] }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the notice", "error");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await httpClient.post<{ data: Notice }>("/accounts/notices", {
        ...f, amount: f.amount === "" ? null : Number(f.amount),
        source: read && !read.read.problem ? "photo" : "typed", aiSuggestion: read?.aiSuggestion ?? null,
      });
      // The notice itself kept with it, for the reply.
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/v2/accounts/notices/${res.data._id}/attachments`, { method: "POST", body: fd, credentials: "include" }).catch(() => null);
      }
      qc.invalidateQueries({ queryKey: KEY });
      toast("Notice added — reminders are set", "success");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add a government notice" width="max-w-2xl">
      <div className="space-y-3">
        <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden" aria-label="notice file" onChange={(e) => readIt(e.target.files)} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" loading={reading} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {read ? "Read another file" : "Attach the notice (PDF or photos)"}</Button>
          {read && !read.read.problem && <span className="text-xs text-ink-500" role="status">Filled in from the notice — check the reply date against it.</span>}
        </div>
        {read?.already && <p role="alert" className="rounded-lg bg-status-warningBg p-2 text-sm text-status-warning">Notice {read.already.reference} is already in the register ({read.already.status}).</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="From" value={f.authority} onChange={(e) => set("authority", e.target.value as Authority)} options={Object.entries(AUTHORITY).map(([value, label]) => ({ value, label }))} />
          <Input label="Form / section" value={f.form} onChange={(e) => set("form", e.target.value)} placeholder="ASMT-10" />
          <Input label="Reference / DIN" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
          <Input label="Subject" value={f.subject} onChange={(e) => set("subject", e.target.value)} className="sm:col-span-2" />
          <Input label="Period" value={f.periodText} onChange={(e) => set("periodText", e.target.value)} placeholder="Apr 2024 – Mar 2025" />
          <Input label="Amount (₹)" type="number" min={0} value={f.amount} onChange={(e) => set("amount", e.target.value === "" ? "" : Number(e.target.value))} />
          <Input label="Issued on" type="date" value={f.issuedOn} onChange={(e) => set("issuedOn", e.target.value)} />
          <Input label="Reply by" type="date" value={f.replyBy} onChange={(e) => { set("replyBy", e.target.value); set("replyByAssumed", false); }} hint={f.replyByAssumed ? "Not printed on the notice — this is the legal limit. Confirm it on the portal." : undefined} />
          <Input label="Who is handling it" value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. our CA" className="sm:col-span-3" />
        </div>
        {f.summary && <p className="rounded-lg bg-ink-50 p-2 text-sm text-ink-600"><FileWarning className="mr-1 inline h-4 w-4" />{f.summary}</p>}
        {f.documents.length > 0 && (
          <div className="text-sm">
            <p className="font-medium text-ink-700">The reply needs</p>
            <ul className="list-disc pl-5 text-ink-600">{f.documents.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!f.form.trim() && !f.subject.trim()} onClick={save}>Add to the register</Button>
        </div>
      </div>
    </Modal>
  );
}

function ReplyNotice({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [replyRef, setReplyRef] = useState("");
  const [repliedOn, setRepliedOn] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await httpClient.patch(`/accounts/notices/${notice._id}`, { status: "replied", replyRef, repliedOn });
      qc.invalidateQueries({ queryKey: KEY });
      toast("Marked replied — no more reminders", "success");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Replied · ${notice.form || notice.subject}`}>
      <div className="space-y-3">
        <Input label="Acknowledgement / ARN" value={replyRef} onChange={(e) => setReplyRef(e.target.value)} />
        <Input label="Replied on" type="date" value={repliedOn} onChange={(e) => setRepliedOn(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!replyRef.trim()} onClick={save}>Mark replied</Button>
        </div>
      </div>
    </Modal>
  );
}
