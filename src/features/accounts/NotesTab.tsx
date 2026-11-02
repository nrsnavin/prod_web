import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
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
import { useAccountsMutations, useNotes } from "./hooks";
import { LinesEditor, PartyPicker, blankLine, money, today } from "./shared";
import type { AccountNote, LineInput, NoteKind } from "./types";

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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Note no., party, document, reason…" className="w-full max-w-xs" />
        <FilterChips options={[{ value: "all", label: "All" }, { value: "credit", label: "Credit notes" }, { value: "debit", label: "Debit notes" }]} value={kind} onChange={(v) => { setKind(v); setPage(1); }} />
        <span className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setParams({ new: "credit" })}><Plus className="h-4 w-4" /> Credit note</Button>
          <Button variant="secondary" onClick={() => setParams({ new: "debit" })}><Plus className="h-4 w-4" /> Debit note to supplier</Button>
          <Button variant="secondary" onClick={() => setParams({ new: "debit-customer" })}><Plus className="h-4 w-4" /> Debit note to customer</Button>
        </span>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.notes ?? []} rowKey={(n) => n._id} onRowClick={(n) => navigate(`/accounts/notes/${n._id}`)} loading={isLoading}
          emptyTitle="No notes yet" emptyDescription="A credit note reduces what a customer owes on an invoice. A debit note reduces what you owe on a supplier's bill, or charges a customer more on an invoice." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      <FormScreen open={!!creating} onClose={() => setParams({})} title={creating ? FORM_TITLES[creating] : ""} width="max-w-4xl">
        {creating && <NoteForm form={creating} onDone={(id) => { setParams({}); navigate(`/accounts/notes/${id}`); }} onCancel={() => setParams({})} />}
      </FormScreen>
    </>
  );
}

/**
 * Against one of our invoices (a credit note, or a debit note charging
 * the customer more) or one of a supplier's bills (a debit note), with
 * its own GST lines.
 */
export function NoteForm({ form, onDone, onCancel }: { form: NoteFormKind; onDone: (id: string) => void; onCancel: () => void }) {
  const { toast } = useToast();
  const { createNote } = useAccountsMutations();
  const kind: NoteKind = form === "credit" ? "credit" : "debit";
  const partyType = form === "debit" ? "supplier" : "customer";
  const [partyNoteNo, setPartyNoteNo] = useState("");
  const [party, setParty] = useState("");
  const [docs, setDocs] = useState<Array<{ id: string; label: string; supplyType: SupplyType; gstPercent: number }>>([]);
  const [doc, setDoc] = useState("");
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<LineInput[]>([blankLine(5)]);
  const [notes, setNotes] = useState("");

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
      { kind, partyType, against: { doc }, reason: reason.trim(), date, lines, notes: notes.trim() || undefined, partyNoteNo: partyNoteNo.trim() || undefined },
      {
        onSuccess: (n) => { toast(`${n.noteNo} issued`, "success"); onDone(n._id); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not issue the note", "error"),
      }
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <PartyPicker partyType={partyType} value={party} onChange={(id) => { setParty(id); setDoc(""); }} />
        <Select label={partyType === "customer" ? "Against invoice *" : "Against bill *"} value={doc} onChange={(e) => setDoc(e.target.value)} disabled={!party} options={docs.map((d) => ({ value: d.id, label: d.label }))} placeholder={party ? "Pick the document" : "Pick the party first"} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={form === "credit" ? "e.g. Rate difference agreed, 200 m returned" : form === "debit" ? "e.g. Short supply 4 kg, rejected lot" : "e.g. Freight billed later, rate revision"} />
        {partyType === "supplier" && <Input label="Their credit note no." value={partyNoteNo} onChange={(e) => setPartyNoteNo(e.target.value)} placeholder="When the supplier sent one" />}
      </div>
      <LinesEditor lines={lines} onChange={setLines} supplyType={chosen?.supplyType ?? "intra"} />
      {form !== "debit-customer" && <p className="text-xs text-ink-400">Whatever the document no longer owes stays as credit on the party's account, to apply to another document.</p>}
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready} loading={createNote.isPending}>{kind === "credit" ? "Issue credit note" : "Issue debit note"}</Button>
      </div>
    </div>
  );
}
