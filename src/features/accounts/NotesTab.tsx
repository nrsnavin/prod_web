import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
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
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { invoiceService } from "@/features/invoices/api";
import type { SupplyType } from "@/features/invoices/types";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useAccountsMutations, useNotes } from "./hooks";
import { LinesEditor, PartyPicker, blankLine, money, today } from "./shared";
import type { AccountNote, CreditNoteLimit, InterestDraft, LineInput, NoteKind } from "./types";

/** Which of the three notes this is. */
export type NoteFormKind = "credit" | "debit" | "debit-customer";
export const noteKindLabel = (n: Pick<AccountNote, "kind" | "partyType">) =>
  n.kind === "credit" ? "Credit note" : n.partyType === "customer" ? "Debit note to customer" : "Debit note";
const FORM_TITLES: Record<NoteFormKind, string> = {
  credit: "Credit note to a customer",
  debit: "Debit note to a supplier",
  "debit-customer": "Debit note to a customer",
};

const columns: Column<AccountNote>[] = [
  { key: "no", header: "Note", render: (n) => <span className="font-medium">{n.noteNo}</span> },
  { key: "kind", header: "Kind", render: (n) => <StatusChip tone={n.kind === "credit" ? "info" : "warning"}>{noteKindLabel(n)}</StatusChip> },
  { key: "date", header: "Date", render: (n) => formatDate(n.date) },
  { key: "party", header: "Party", render: (n) => n.partyName },
  { key: "against", header: "Against", render: (n) => n.against.docNo },
  { key: "reason", header: "Reason", render: (n) => n.reason, cellClassName: "whitespace-normal" },
  { key: "amount", header: "Amount (₹)", align: "right", render: (n) => <span>{money(n.totals?.grand)}{n.unapplied ? <span className="block text-xs text-status-warning">₹{money(n.unapplied)} unapplied</span> : null}</span> },
  { key: "status", header: "Status", render: (n) => <StatusChip tone={n.status === "issued" ? "success" : "danger"}>{n.status}</StatusChip> },
];

export function NotesTab() {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<NoteKind | "all">("all");
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data, isLoading } = useNotes({ page, kind, search });
  const raw = params.get("new");
  const creating: NoteFormKind | null = raw === "credit" || raw === "debit" || raw === "debit-customer" ? raw : null;
  // Sent here from the interest register: the debit note comes drafted.
  const interestFor = params.get("interest");
  const asOf = params.get("asOf") ?? undefined;
  const draft = useQuery({ queryKey: [ACCOUNTS_KEY, "interest-draft", interestFor, asOf], queryFn: () => accountsService.interestDraft(interestFor!, asOf), enabled: !!interestFor && creating === "debit-customer" });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Note no., party, document, reason…" className="w-full max-w-xs" />
        <FilterChips options={[{ value: "all", label: "All" }, { value: "credit", label: "Credit notes" }, { value: "debit", label: "Debit notes" }]} value={kind} onChange={(v) => { setKind(v); setPage(1); }} />
        <span className="ml-auto flex flex-wrap gap-2">
          <a href={accountsService.exportUrl("notes")} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-brand-600 hover:bg-brand-50"><Download className="h-4 w-4" /> Excel</a>
          {/* On a phone the three kinds are one picker, not three stacked buttons. */}
          <select aria-label="New note" value="" onChange={(e) => e.target.value && setParams({ new: e.target.value })}
            className="h-10 rounded-lg border border-ink-200 bg-surface px-3 text-sm sm:hidden">
            <option value="">+ New note…</option>
            <option value="credit">Credit note to a customer</option>
            <option value="debit">Debit note to a supplier</option>
            <option value="debit-customer">Debit note to a customer</option>
          </select>
          <span className="hidden flex-wrap gap-2 sm:flex">
            <Button variant="secondary" onClick={() => setParams({ new: "credit" })}><Plus className="h-4 w-4" /> Credit note</Button>
            <Button variant="secondary" onClick={() => setParams({ new: "debit" })}><Plus className="h-4 w-4" /> Debit note to supplier</Button>
            <Button variant="secondary" onClick={() => setParams({ new: "debit-customer" })}><Plus className="h-4 w-4" /> Debit note to customer</Button>
          </span>
        </span>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.notes ?? []} rowKey={(n) => n._id} onRowClick={(n) => navigate(`/accounts/notes/${n._id}`)} loading={isLoading}
          emptyTitle="No notes yet" emptyDescription="A credit note reduces what a customer owes on an invoice. A debit note reduces what you owe on a supplier's bill, or charges a customer more on an invoice." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      <FormScreen open={!!creating} onClose={() => setParams({})} title={creating ? FORM_TITLES[creating] : ""} width="max-w-4xl">
        {creating && (!interestFor || draft.data) && <NoteForm key={draft.data?.customer ?? "blank"} form={creating} initial={interestFor ? draft.data : undefined} onDone={(id) => { setParams({}); navigate(`/accounts/notes/${id}`); }} onCancel={() => setParams({})} />}
        {creating && interestFor && draft.isError && <p className="text-sm text-status-danger">{(draft.error as Error).message}</p>}
      </FormScreen>
    </>
  );
}

/**
 * Against one of our invoices (a credit note, or a debit note charging
 * the customer more) or one of a supplier's bills (a debit note), with
 * its own GST lines.
 */
export function NoteForm({ form, initial, onDone, onCancel }: { form: NoteFormKind; initial?: InterestDraft; onDone: (id: string) => void; onCancel: () => void }) {
  const { toast } = useToast();
  const { createNote } = useAccountsMutations();
  const kind: NoteKind = form === "credit" ? "credit" : "debit";
  const partyType = form === "debit" ? "supplier" : "customer";
  const [partyNoteNo, setPartyNoteNo] = useState("");
  const [party, setParty] = useState(initial?.customer ?? "");
  const [docs, setDocs] = useState<Array<{ id: string; label: string; supplyType: SupplyType; gstPercent: number }>>([]);
  const [doc, setDoc] = useState(initial?.body.against.doc ?? "");
  const [date, setDate] = useState(initial?.body.date ?? today());
  const [reason, setReason] = useState(initial?.body.reason ?? "");
  const [lines, setLines] = useState<LineInput[]>(initial ? initial.body.lines.map((l) => ({ description: l.description, hsn: l.hsn ?? "", unit: l.unit ?? "", quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent })) : [blankLine(5)]);
  const [notes, setNotes] = useState("");
  // s.34(2): a GST credit note is allowed until 30 November of the year after the invoice's.
  const [limit, setLimit] = useState<CreditNoteLimit | null>(null);
  const [financial, setFinancial] = useState(false);
  useEffect(() => {
    if (kind !== "credit" || !doc) { setLimit(null); setFinancial(false); return; }
    let live = true;
    accountsService.creditNoteLimit(doc).then((l) => { if (live) { setLimit(l); setFinancial(l.past); } }).catch(() => { if (live) setLimit(null); });
    return () => { live = false; };
  }, [kind, doc]);

  useEffect(() => {
    if (!party) { setDocs([]); setDoc(""); return; }
    let live = true;
    const load = partyType === "customer"
      ? invoiceService.list({ customer: party, status: "issued", limit: 50 }).then((r) => r.invoices.map((i) => ({ id: i._id, label: `${i.invoiceNumber} · ${formatDate(i.invoiceDate)} · ₹${money(i.totals?.grand)}`, supplyType: i.supplyType, gstPercent: 5 })))
      : accountsService.bills({ supplier: party, limit: 50 }).then((r) => r.bills.filter((b) => b.status !== "cancelled").map((b) => ({ id: b._id, label: `${b.billNo} · ${b.supplierBillNo} · ₹${money(b.totals?.grand)}`, supplyType: b.supplyType, gstPercent: 5 })));
    load.then((d) => { if (live) setDocs(d); }).catch(() => {});
    return () => { live = false; };
  }, [party, partyType]);

  const chosen = docs.find((d) => d.id === doc);
  const ready = party && doc && reason.trim().length >= 3 && lines.every((l) => l.description.trim() && l.rate !== "");

  const submit = () =>
    createNote.mutate(
      { kind, partyType, against: { doc }, reason: reason.trim(), date, lines, notes: notes.trim() || undefined, partyNoteNo: partyNoteNo.trim() || undefined, financial: kind === "credit" && financial ? true : undefined, interest: initial?.body.interest },
      {
        onSuccess: (n) => { toast(`${n.noteNo} issued`, "success"); onDone(n._id); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not issue the note", "error"),
      }
    );

  return (
    <div className="space-y-4">
      {initial && <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm">Interest of ₹{money(initial.total)} on {initial.rows.length} overdue invoice{initial.rows.length === 1 ? "" : "s"} of {initial.partyName}, to {formatDate(initial.asOf)}. The note remembers the days it charged, so the next one starts after them.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <PartyPicker partyType={partyType} value={party} onChange={(id) => { setParty(id); setDoc(""); }} />
        <Select label={partyType === "customer" ? "Against invoice *" : "Against bill *"} value={doc} onChange={(e) => setDoc(e.target.value)} disabled={!party} options={docs.map((d) => ({ value: d.id, label: d.label }))} placeholder={party ? "Pick the document" : "Pick the party first"} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={form === "credit" ? "e.g. Rate difference agreed, 200 m returned" : form === "debit" ? "e.g. Short supply 4 kg, rejected lot" : "e.g. Freight billed later, rate revision"} />
        {partyType === "supplier" && <Input label="Their credit note no." value={partyNoteNo} onChange={(e) => setPartyNoteNo(e.target.value)} placeholder="When the supplier sent one" />}
      </div>
      {limit && (limit.past || limit.soon) && (
        <div role="alert" className={`rounded-lg px-3 py-2 text-sm ${limit.past ? "bg-status-dangerBg text-status-danger" : "bg-status-warningBg text-status-warning"}`}>
          {limit.past
            ? <>A GST credit note against {limit.invoiceNumber} could be declared only until {formatDate(limit.limit)} (s.34(2)). This one goes as a <strong>financial credit note</strong>: the customer's account comes down, no GST moves, nothing is reported in GSTR-1.</>
            : <>GST on a credit note against {limit.invoiceNumber} can be declared only until {formatDate(limit.limit)} ({limit.daysLeft} days left).</>}
          {!limit.past && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={financial} onChange={(e) => setFinancial(e.target.checked)} /> Issue as a financial credit note anyway (no GST)</label>}
        </div>
      )}
      <LinesEditor lines={lines} onChange={setLines} supplyType={chosen?.supplyType ?? "intra"} />
      {financial && <p className="text-xs text-ink-500">GST on the lines is ignored: the note is for the taxable value only.</p>}
      {form !== "debit-customer" && <p className="text-xs text-ink-400">Whatever the document no longer owes stays as credit on the party's account, to apply to another document.</p>}
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready} loading={createNote.isPending}>{kind === "credit" ? "Issue credit note" : "Issue debit note"}</Button>
      </div>
    </div>
  );
}
