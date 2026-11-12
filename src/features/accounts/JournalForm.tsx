import { useState } from "react";
import { quickCreate } from "@/features/common/quickCreateStore";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAccountsMutations, useBankAccounts, useCategories, useOpenDocs } from "./hooks";
import { accountsService } from "./api";
import { PartyPicker, money, today } from "./shared";
import type { JournalDraft, JournalLineInput, JournalPurpose, OpenDoc, SettleDocType } from "./types";

type Line = { kind: JournalLineInput["kind"]; ledger: string; partyType: "customer" | "supplier"; party: string; partyName: string; account: string; category: string; debit: number | ""; credit: number | ""; refs: Record<string, number>; /** What a drafted line is for, shown under it. */ hint?: string };
const blank = (): Line => ({ kind: "ledger", ledger: "", partyType: "customer", party: "", partyName: "", account: "", category: "", debit: "", credit: "", refs: {} });
/** A drafted journal's lines, as the form holds them: the account of a bank line is left for the person to pick. */
const fromDraft = (d: JournalDraft): Line[] => d.lines.map((l) => ({ ...blank(), kind: l.kind, ledger: l.ledger ?? "", account: l.account ?? "", debit: l.debit > 0 ? l.debit : "", credit: l.credit > 0 ? l.credit : "", hint: l.note }));

/** What a drafted journal is posted with, in place of the general journal route. */
export type DraftPost = (body: { lines: JournalLineInput[]; narration?: string; reason: string }) => Promise<{ _id: string; journalNo: string; replay?: boolean; replaced?: string | null }>;

const PURPOSES: Array<{ value: JournalPurpose; label: string }> = [
  { value: "setoff", label: "Set-off (customer who is also a supplier)" }, { value: "writeoff", label: "Write-off" }, { value: "accrual", label: "Accrual / provision" },
  { value: "salary", label: "Salary payable" }, { value: "depreciation", label: "Depreciation" }, { value: "stock", label: "Closing stock" }, { value: "reclass", label: "Reclassification" }, { value: "other", label: "Other" },
];

/** A party line can set what it lowers against that party's open documents. */
function Refs({ line, onChange }: { line: Line; onChange: (refs: Record<string, number>) => void }) {
  const lowers = line.partyType === "customer" ? Number(line.credit) > 0 : Number(line.debit) > 0;
  const { data } = useOpenDocs(line.party ? line.partyType : undefined, line.party || undefined);
  if (!line.party) return null;
  const amount = Number(line.debit || line.credit) || 0;
  // A journal only settles a party's open documents, in full: raising a party is a debit note (customer) or a bill / expense (supplier).
  if (!lowers) return amount > 0 ? <p className="text-xs text-status-danger">A journal cannot raise what a party owes — issue a debit note to a customer, or enter a supplier's bill or an expense.</p> : null;
  const docs = data?.docs ?? [];
  if (!docs.length) return <p className="text-xs text-status-danger">Nothing open for this party — a journal can only settle open documents.</p>;
  const used = Object.values(line.refs).reduce((t, v) => t + v, 0);
  return (
    <div className="rounded-md border border-ink-100 p-2">
      <p className={`mb-1 text-xs ${amount > 0 && Math.abs(used - amount) > 0.005 ? "text-status-danger" : "text-ink-500"}`}>Set against ({money(used)} of {money(amount)}){amount > 0 && Math.abs(used - amount) > 0.005 ? " — the whole amount must be set against documents" : ""}</p>
      <ul className="space-y-1">
        {docs.map((d: OpenDoc) => {
          const key = `${d.docType}|${d.id}`;
          const on = line.refs[key] !== undefined;
          return (
            <li key={key} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="checkbox" aria-label={`Set against ${d.docNo}`} checked={on} onChange={(e) => { const next = { ...line.refs }; if (e.target.checked) next[key] = Math.min(d.outstanding, Math.max(0, amount - used)); else delete next[key]; onChange(next); }} />
              <span className="min-w-0 flex-1 truncate">{d.docNo} <span className="text-ink-400">· {money(d.outstanding)} open</span></span>
              {on && <Input aria-label={`Amount against ${d.docNo}`} type="number" step="0.01" min={0} max={d.outstanding} className="w-32" value={line.refs[key]} onChange={(e) => onChange({ ...line.refs, [key]: Math.min(d.outstanding, Number(e.target.value) || 0) })} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A journal: any number of debit and credit lines, each a party, a
 * bank or cash account, an expense head, or a Tally ledger by name.
 * Debits must equal credits. A reason is always required.
 *
 * With a `draft` (the journal that takes a sold asset off the books)
 * the form opens filled in, for the person to pick the account and
 * check the ledger names; `post` then sends it where that journal is
 * kept, and its date and purpose are the draft's.
 */
export function JournalForm({ onDone, onCancel, draft, post }: { onDone: (id: string) => void; onCancel: () => void; draft?: JournalDraft; post?: DraftPost }) {
  const { toast } = useToast();
  const { createJournal } = useAccountsMutations();
  const { data: accounts } = useBankAccounts();
  const { data: categories } = useCategories();
  const [date, setDate] = useState(draft ? String(draft.date).slice(0, 10) : today());
  const [purpose, setPurpose] = useState<JournalPurpose>(draft?.purpose ?? "other");
  const [reason, setReason] = useState(draft?.reason ?? "");
  const [narration, setNarration] = useState(draft?.narration ?? "");
  const [ideas, setIdeas] = useState<{ text: string; from: string }[]>([]);
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [sending, setSending] = useState(false);
  const [lines, setLines] = useState<Line[]>(() => (draft ? fromDraft(draft) : [{ ...blank(), kind: "party" }, blank()]));
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const dr = lines.reduce((t, l) => t + (Number(l.debit) || 0), 0);
  const cr = lines.reduce((t, l) => t + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(dr - cr) < 0.005 && dr > 0;
  const complete = lines.every((l) => (l.kind === "party" ? !!l.party : l.kind === "bank" ? !!l.account : l.kind === "head" ? !!l.category : l.ledger.trim().length >= 2) && ((Number(l.debit) || 0) > 0) !== ((Number(l.credit) || 0) > 0));
  const ready = balanced && complete && reason.trim().length >= 8;

  const toLines = (): JournalLineInput[] => lines.map((l) => ({
      kind: l.kind, ledger: l.kind === "ledger" ? l.ledger.trim() : undefined, partyType: l.kind === "party" ? l.partyType : undefined, party: l.kind === "party" ? l.party : undefined,
      account: l.kind === "bank" ? l.account : undefined, category: l.kind === "head" ? l.category : undefined,
      debit: Number(l.debit) || 0, credit: Number(l.credit) || 0,
      refs: Object.entries(l.refs).filter(([, v]) => v > 0).map(([k, v]) => { const [docType, doc] = k.split("|"); return { docType: docType as SettleDocType, doc, amount: v }; }),
    }));
  const suggestNarration = async () => {
    setThinking(true);
    try {
      const r = await accountsService.journalNarration({ purpose, lines: toLines() });
      setIdeas(r.suggestions); setIdeaId(r.aiSuggestion);
      if (!narration.trim() && r.suggestions[0]) setNarration(r.suggestions[0].text);
    } catch (e) { toast(e instanceof ApiError ? e.message : "Fill in the lines first", "error"); } finally { setThinking(false); }
  };

  // A drafted journal goes where it is kept (one for the thing it is for), and says what became of the one before.
  const sendDraft = async (send: DraftPost) => {
    setSending(true);
    try {
      const j = await send({ lines: toLines(), narration: narration.trim() || undefined, reason: reason.trim() });
      toast(j.replay ? `${j.journalNo} is already in the books for it — nothing posted again` : `${j.journalNo} posted${j.replaced ? `, in place of ${j.replaced}` : ""}`, j.replay ? "info" : "success");
      onDone(j._id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not post", "error");
    } finally {
      setSending(false);
    }
  };
  const submit = () => (post ? void sendDraft(post) : createJournal.mutate({
    date, purpose, reason: reason.trim(), narration: narration.trim() || undefined, ...(ideaId ? { aiSuggestion: ideaId } : {}),
    lines: toLines(),
  }, { onSuccess: (j) => { toast(`${j.journalNo} posted`, "success"); onDone(j._id); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not post", "error") }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {/* A drafted journal is dated and filed by what it is for: the day the asset went. */}
        <Input label="Date" type="date" value={date} disabled={!!post} onChange={(e) => setDate(e.target.value)} />
        <Select label="What for" value={purpose} disabled={!!post} onChange={(e) => setPurpose(e.target.value as JournalPurpose)} options={PURPOSES} />
        <div className="flex items-end gap-1">
          <Input label="Narration" className="flex-1" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Shown on the ledger and in Tally" />
          <Button type="button" size="sm" variant="ghost" title="Suggest a narration" aria-label="Suggest a narration" loading={thinking} disabled={!balanced || !complete} onClick={suggestNarration}><Sparkles className="h-4 w-4" /></Button>
        </div>
      </div>
      {ideas.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Narration suggestions">
          {ideas.map((x) => (
            <button key={x.text} type="button" onClick={() => setNarration(x.text)} className={`rounded-full border px-3 py-1 text-left text-xs ${narration === x.text ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-600 hover:border-ink-400"}`}>
              {x.text}<span className="ml-1 text-ink-400">· {x.from === "past" ? "used before" : x.from === "model" ? "suggested" : "plain"}</span>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {lines.map((l, i) => (
          <div key={i} className="rounded-lg border border-ink-200 p-3">
            <div className="grid gap-3 sm:grid-cols-[150px_1fr_130px_130px_auto]">
              <Select label={`Line ${i + 1}`} value={l.kind} onChange={(e) => set(i, { ...blank(), kind: e.target.value as Line["kind"], debit: l.debit, credit: l.credit })} options={[{ value: "party", label: "Customer / supplier" }, { value: "bank", label: "Bank / cash" }, { value: "head", label: "Expense head" }, { value: "ledger", label: "Tally ledger" }]} />
              <div className="min-w-0">
                {l.kind === "party" && (
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <Select label="Side" value={l.partyType} onChange={(e) => set(i, { partyType: e.target.value as "customer" | "supplier", party: "", partyName: "", refs: {} })} options={[{ value: "customer", label: "Customer" }, { value: "supplier", label: "Supplier" }]} />
                    <PartyPicker partyType={l.partyType} value={l.party} onChange={(id, name) => set(i, { party: id, partyName: name, refs: {} })} />
                  </div>
                )}
                {l.kind === "bank" && <Select label="Account" value={l.account} onChange={(e) => set(i, { account: e.target.value })} onCreate={() => void quickCreate("bankAccount").then((o) => o && set(i, { account: o.value }))} createLabel="account" options={(accounts ?? []).filter((a) => a.active !== false).map((a) => ({ value: a._id, label: a.name }))} placeholder="Pick the account" />}
                {l.kind === "head" && <Select label="Head" value={l.category} onChange={(e) => set(i, { category: e.target.value })} onCreate={() => void quickCreate("expenseHead").then((o) => o && set(i, { category: o.value }))} createLabel="expense head" options={(categories ?? []).map((c) => ({ value: c._id, label: c.name }))} placeholder="Pick the head" />}
                {l.kind === "ledger" && <Input label="Ledger, as named in Tally" value={l.ledger} onChange={(e) => set(i, { ledger: e.target.value })} placeholder="e.g. Depreciation, Salaries Payable, Bad Debts Written Off" />}
              </div>
              <Input label="Debit" type="number" step="0.01" min={0} value={l.debit} onChange={(e) => set(i, { debit: e.target.value === "" ? "" : Number(e.target.value), credit: "" })} />
              <Input label="Credit" type="number" step="0.01" min={0} value={l.credit} onChange={(e) => set(i, { credit: e.target.value === "" ? "" : Number(e.target.value), debit: "" })} />
              <div className="flex items-end"><Button variant="ghost" size="sm" aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 2} onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
            {l.hint && <p className="mt-1 text-xs text-ink-400">{l.hint}</p>}
            {l.kind === "party" && <div className="mt-2"><Refs line={l} onChange={(refs) => set(i, { refs })} /></div>}
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="h-4 w-4" /> Add a line</Button>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>Debits <span className="font-semibold tabular-nums">₹{money(dr)}</span></span>
        <span>Credits <span className="font-semibold tabular-nums">₹{money(cr)}</span></span>
        {dr > 0 || cr > 0 ? (balanced ? <span className="text-status-success">balanced</span> : <span className="text-status-danger">off by ₹{money(Math.abs(dr - cr))}</span>) : null}
      </div>
      <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this entry: at least 8 characters, kept with the voucher" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button disabled={!ready} loading={createJournal.isPending || sending} onClick={submit}>Post journal</Button>
      </div>
    </div>
  );
}
