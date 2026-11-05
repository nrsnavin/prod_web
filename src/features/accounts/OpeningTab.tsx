import { useRef, useState } from "react";
import { Download, Plus, Upload, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { useAccountsMutations, useOpeningBalances } from "./hooks";
import { PartyPicker, money } from "./shared";
import type { OpeningBalance, OpeningImportRow } from "./types";

export const kindLabel = (o: Pick<OpeningBalance, "partyType" | "kind">) =>
  o.kind === "due" ? (o.partyType === "customer" ? "They owe us" : "We owe them") : o.partyType === "customer" ? "They paid ahead" : "We paid ahead";

/**
 * What every customer and supplier owed, or had paid ahead, on the day
 * the books start here — typed in, or imported from a Tally ledger
 * export. One row per open bill keeps the ageing right from day one.
 */
export function OpeningTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [partyType, setPartyType] = useState<"all" | "customer" | "supplier">("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useOpeningBalances({ page, partyType, search, status: "posted" });
  const { cancelOpening } = useAccountsMutations();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cancelling, setCancelling] = useState<OpeningBalance | null>(null);

  const columns: Column<OpeningBalance>[] = [
    { key: "no", header: "No.", render: (o) => <span className="font-medium">{o.docNo}</span> },
    { key: "party", header: "Party", render: (o) => <span>{o.partyName}<span className="block text-xs text-ink-400">{o.partyType}</span></span> },
    { key: "kind", header: "Balance", render: (o) => <StatusChip tone={o.kind === "due" ? "warning" : "info"}>{kindLabel(o)}</StatusChip> },
    { key: "ref", header: "Old ref", render: (o) => o.refNo || "—" },
    { key: "date", header: "Date", render: (o) => formatDate(o.date) },
    { key: "due", header: "Due", render: (o) => (o.dueDate ? formatDate(o.dueDate) : "—") },
    { key: "amount", header: "Amount (₹)", align: "right", render: (o) => money(o.amount) },
    { key: "left", header: "Still open (₹)", align: "right", render: (o) => money(o.kind === "due" ? o.amount - (o.settledAmount || 0) : o.unapplied) },
    { key: "act", header: "", render: (o) => (o.settledAmount || 0) === 0 && (o.kind === "due" || o.unapplied === o.amount)
      ? <Button size="sm" variant="ghost" aria-label={`Cancel ${o.docNo}`} onClick={() => setCancelling(o)}><XCircle className="h-4 w-4" /></Button> : null },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Customers</p>
          <p className="mt-1 text-sm">Owe us <span className="font-semibold tabular-nums">₹{money(data?.totals.customer.due)}</span> · paid ahead <span className="tabular-nums">₹{money(data?.totals.customer.advance)}</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Suppliers</p>
          <p className="mt-1 text-sm">We owe <span className="font-semibold tabular-nums">₹{money(data?.totals.supplier.due)}</span> · paid ahead <span className="tabular-nums">₹{money(data?.totals.supplier.advance)}</span></p>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Party, old ref, OB no.…" className="w-full max-w-xs" />
        <FilterChips options={[{ value: "all", label: "All" }, { value: "customer", label: "Customers" }, { value: "supplier", label: "Suppliers" }]} value={partyType} onChange={(v) => { setPartyType(v); setPage(1); }} />
        <span className="ml-auto flex flex-wrap gap-2">
          <a href={accountsService.openingTemplateUrl} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-brand-600 hover:bg-brand-50"><Download className="h-4 w-4" /> Template</a>
          <Button variant="secondary" onClick={() => setImporting(true)}><Upload className="h-4 w-4" /> Import from Excel</Button>
          <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add balance</Button>
        </span>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.rows ?? []} rowKey={(o) => o._id} loading={isLoading}
          emptyTitle="No opening balances yet" emptyDescription="Bring each party's balance over from Tally — one row per open bill — so ageing and collections are right from the first day." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      {adding && <OpeningForm onClose={() => setAdding(false)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      <ReasonDialog open={!!cancelling} onClose={() => setCancelling(null)} title={`Cancel ${cancelling?.docNo}?`} description="It leaves the party's account." confirmLabel="Cancel balance" minLength={8} loading={cancelOpening.isPending}
        onConfirm={(reason) => cancelling && cancelOpening.mutate({ id: cancelling._id, reason }, { onSuccess: () => { setCancelling(null); toast("Cancelled", "success"); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error") })} />
    </div>
  );
}

/**
 * One opening balance, typed in. From the Opening tab any party is
 * picked; from a customer's or supplier's own page (`fixed`) the party
 * is that one, and the form says so instead of asking.
 */
export function OpeningForm({ onClose, fixed, onPosted }: {
  onClose: () => void;
  /** The party this balance is for, when opened from their page. */
  fixed?: { partyType: "customer" | "supplier"; id: string; name: string };
  onPosted?: (o: OpeningBalance) => void;
}) {
  const { toast } = useToast();
  const { createOpening } = useAccountsMutations();
  const [partyType, setPartyType] = useState<"customer" | "supplier">(fixed?.partyType ?? "customer");
  const [party, setParty] = useState(fixed?.id ?? "");
  const [kind, setKind] = useState<"due" | "advance">("due");
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const ready = party && date && Number(amount) > 0;
  return (
    <Modal open onClose={onClose} title={fixed ? `Opening balance for ${fixed.name}` : "Add an opening balance"} width="max-w-2xl">
      <p className="mb-3 text-sm text-ink-500">What was owed on the day the books start here — one row per open bill, as in the old ledger, so ageing is right from day one. Nothing else moves: the first invoice or bill after this date is entered as usual.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fixed ? (
          <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm sm:col-span-2" aria-label="Party">
            <span className="text-ink-500">{fixed.partyType === "customer" ? "Customer" : "Supplier"} </span>
            <span className="font-semibold">{fixed.name}</span>
          </div>
        ) : (
          <>
            <Select label="Party type" value={partyType} onChange={(e) => { setPartyType(e.target.value as "customer" | "supplier"); setParty(""); }} options={[{ value: "customer", label: "Customer" }, { value: "supplier", label: "Supplier" }]} />
            <PartyPicker partyType={partyType} value={party} onChange={(id) => setParty(id)} />
          </>
        )}
        <Select label="Balance" value={kind} onChange={(e) => setKind(e.target.value as "due" | "advance")} options={[
          { value: "due", label: partyType === "customer" ? "They owe us (Dr)" : "We owe them (Cr)" },
          { value: "advance", label: partyType === "customer" ? "They paid ahead (Cr)" : "We paid ahead (Dr)" },
        ]} />
        <Input label="Old bill / ref no." value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="As in Tally" />
        <Input label="Bill date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {kind === "due" && <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} hint="Blank: bill date + the party's terms" />}
        <Input label="Amount *" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!ready} loading={createOpening.isPending} onClick={() => createOpening.mutate(
          { partyType, party, kind, refNo: refNo.trim() || undefined, date, dueDate: dueDate || undefined, amount: Number(amount) },
          { onSuccess: (o) => { toast(`${o.docNo} posted`, "success"); onPosted?.(o); onClose(); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not post", "error") }
        )}>Post balance</Button>
      </div>
    </Modal>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const { bulkOpening } = useAccountsMutations();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<OpeningImportRow[] | null>(null);
  const [file, setFile] = useState("");
  const [asOn, setAsOn] = useState("");
  const [results, setResults] = useState<Record<number, string>>({});
  const read = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await accountsService.importOpening(f);
      setRows(r.rows);
      setFile(r.file);
      setResults({});
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the file", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  const good = (rows ?? []).filter((r) => !r.problem && (r.date || asOn));
  const undated = (rows ?? []).filter((r) => !r.problem && !r.date).length;
  const post = () => bulkOpening.mutate(
    good.map((r) => ({ ...r, date: r.date || asOn, requestId: `${file}:${r.line}:${r.amount}` })),
    {
      onSuccess: (res) => {
        const next: Record<number, string> = {};
        res.results.forEach((x) => { const row = good[x.index]; if (row) next[row.line] = x.ok ? x.docNo! : `✗ ${x.error}`; });
        setResults(next);
        toast(`${res.posted} posted${res.failed ? `, ${res.failed} failed` : ""}`, res.failed ? "info" : "success");
      },
      onError: (e) => toast(e instanceof ApiError ? e.message : "Could not post", "error"),
    }
  );
  return (
    <Modal open onClose={onClose} title="Import opening balances" width="max-w-5xl">
      <div className="flex flex-wrap items-end gap-3">
        <input ref={ref} type="file" className="hidden" aria-label="Balances file" accept=".xlsx,.xls,.csv" onChange={(e) => read(e.target.files?.[0])} />
        <Button onClick={() => ref.current?.click()} loading={busy}><Upload className="h-4 w-4" /> Choose file</Button>
        <Input label="Date for rows without one" type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
        <p className="text-xs text-ink-400">Columns: Type, Party, GSTIN, Ref, Date, Due date, Amount, Dr/Cr. Parties are matched by GSTIN, then by name.</p>
      </div>
      {rows && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip tone="success">{rows.filter((r) => !r.problem).length} ready</StatusChip>
            {rows.some((r) => r.problem) && <StatusChip tone="danger">{rows.filter((r) => r.problem).length} to fix in the file</StatusChip>}
            {undated > 0 && !asOn && <StatusChip tone="warning">{undated} without a date</StatusChip>}
          </div>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-2 text-left font-medium">Line</th><th className="py-2 text-left font-medium">Party</th><th className="py-2 text-left font-medium">Balance</th><th className="py-2 text-left font-medium">Ref</th><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-right font-medium">Amount</th><th className="py-2 text-left font-medium" /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.line} className={r.problem ? "text-status-danger" : ""}>
                    <td className="py-1.5">{r.line}</td>
                    <td className="py-1.5">{r.partyName}{r.partyType && <span className="text-xs text-ink-400"> · {r.partyType}</span>}</td>
                    <td className="py-1.5">{r.kind && r.partyType ? kindLabel({ kind: r.kind, partyType: r.partyType }) : "—"}</td>
                    <td className="py-1.5">{r.refNo || "—"}</td>
                    <td className="py-1.5">{r.date ? formatDate(r.date) : asOn ? formatDate(asOn) : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(r.amount)}</td>
                    <td className="py-1.5 text-xs">{results[r.line] ? <StatusChip tone={results[r.line].startsWith("✗") ? "danger" : "success"}>{results[r.line]}</StatusChip> : r.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button disabled={!good.length || Object.keys(results).length > 0} loading={bulkOpening.isPending} onClick={post}>Post {good.length} balance{good.length === 1 ? "" : "s"}</Button>
      </div>
    </Modal>
  );
}
