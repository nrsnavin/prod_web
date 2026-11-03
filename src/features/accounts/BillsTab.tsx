import { FlagList, useFlags } from "./Flags";
import { accountsService } from "./api";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Plus, ScanLine, Download } from "lucide-react";
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
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useDocumentSettings } from "@/features/settings/hooks";
import { supplierService } from "@/features/suppliers/api";
import { stateCodeFromGstin } from "@/features/invoices/gst";
import type { SupplyType } from "@/features/invoices/types";
import { useAccountsMutations, useBillPoInfo, useBills, useCategories } from "./hooks";
import { LinesEditor, PartyPicker, billLabel, billTone, blankLine, money, today } from "./shared";
import type { BillStatus, BillVariance, LineInput, SupplierBill } from "./types";
import { ScanBillDialog, type ScanDraft } from "./ScanBill";
import { ExpenseForm } from "./ExpensesTab";

const columns: Column<SupplierBill>[] = [
  { key: "no", header: "Bill", render: (b) => <span className="font-medium">{b.billNo}</span> },
  { key: "supplier", header: "Supplier", render: (b) => b.supplierName },
  { key: "theirs", header: "Their no.", render: (b) => `${b.supplierBillNo} · ${formatDate(b.billDate)}` },
  { key: "po", header: "PO", render: (b) => (b.poNo != null ? `#${b.poNo}` : b.kind === "service" ? "Service" : "—") },
  { key: "amount", header: "Amount (₹)", align: "right", render: (b) => money(b.totals?.grand) },
  { key: "due", header: "Outstanding (₹)", align: "right", render: (b) => <span className={b.outstanding ? "font-semibold" : "text-ink-400"}>{money(b.outstanding)}</span> },
  { key: "dueDate", header: "Due", render: (b) => {
    const late = (b.outstanding ?? 0) > 0.005 && b.dueDate ? Math.floor((Date.now() - new Date(b.dueDate).getTime()) / 86_400_000) : 0;
    return <span className={late > 0 ? "text-status-danger" : ""}>{formatDate(b.dueDate)}{late > 0 && <span className="block text-xs">{late}d overdue</span>}</span>;
  } },
  { key: "status", header: "Status", render: (b) => <StatusChip tone={billTone[b.status]}>{billLabel[b.status]}</StatusChip> },
];

export function BillsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BillStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const createOpen = params.get("new") === "bill";
  const scanOpen = params.get("scan") === "1";
  const navigate = useNavigate();
  const { data, isLoading } = useBills({ page, status, search });
  const location = useLocation();
  // "Cancel and re-enter" comes back here with the cancelled bill as a draft.
  const routeState = location.state as { reenter?: ScanDraft; title?: string } | null;
  const reenter = routeState?.reenter;
  const [draft, setDraft] = useState<{ draft: ScanDraft; as: "bill" | "expense" } | null>(reenter ? { draft: reenter, as: "bill" } : null);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Bill no., supplier, their no., PO…" className="w-full max-w-xs" />
        <FilterChips
          options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "part_paid", label: "Part paid" }, { value: "paid", label: "Paid" }, { value: "cancelled", label: "Cancelled" }]}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
        />
        <span className="ml-auto flex gap-2">
          <a href={accountsService.exportUrl("bills")} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-brand-600 hover:bg-brand-50"><Download className="h-4 w-4" /> Excel</a>
          <Button variant="secondary" onClick={() => setParams({ scan: "1" })}><ScanLine className="h-4 w-4" /> Scan a bill</Button>
          <Button onClick={() => setParams({ new: "bill" })}><Plus className="h-4 w-4" /> Enter bill</Button>
        </span>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.bills ?? []} rowKey={(b) => b._id} onRowClick={(b) => navigate(`/accounts/bills/${b._id}`)} loading={isLoading}
          emptyTitle="No supplier bills yet" emptyDescription="Enter a bill against a purchase order's receipts, or a service bill." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      <FormScreen open={createOpen} onClose={() => setParams({})} title="Enter supplier bill" width="max-w-5xl">
        <BillForm onDone={(id) => { setParams({}); navigate(`/accounts/bills/${id}`); }} onCancel={() => setParams({})} />
      </FormScreen>
      {scanOpen && !draft && <ScanBillDialog onClose={() => setParams({})} onUse={(d, as) => setDraft({ draft: d, as })} />}
      <FormScreen open={draft?.as === "bill"} onClose={() => { setDraft(null); setParams({}); }} title={reenter && draft?.draft === reenter ? (routeState?.title ?? "Re-enter the bill") : "Supplier bill from the scan — check every figure"} width="max-w-5xl">
        {draft?.as === "bill" && <BillForm key={draft.draft.aiSuggestion ?? "scan"} initialDraft={draft.draft} onDone={(id) => { setDraft(null); setParams({}); navigate(`/accounts/bills/${id}`); }} onCancel={() => { setDraft(null); setParams({}); }} />}
      </FormScreen>
      <FormScreen open={draft?.as === "expense"} onClose={() => { setDraft(null); setParams({}); }} title="Expense from the scan — check every figure" width="max-w-4xl">
        {draft?.as === "expense" && <ExpenseForm key={draft.draft.aiSuggestion ?? "scan"} initialDraft={draft.draft} onDone={() => { setDraft(null); setParams({}); navigate("/accounts/expenses"); }} onCancel={() => { setDraft(null); setParams({}); }} />}
      </FormScreen>
    </>
  );
}

/**
 * A supplier bill: against a purchase order (its unbilled receipts come
 * in as lines at the PO price) or a service bill with none.
 */
export function BillForm({ onDone, onCancel, initialPo, initialDraft }: { onDone: (id: string) => void; onCancel: () => void; initialPo?: string; initialDraft?: ScanDraft }) {
  const { toast } = useToast();
  const { createBill } = useAccountsMutations();
  const { data: settings } = useDocumentSettings();
  const { data: categories } = useCategories();
  const [supplier, setSupplier] = useState(initialDraft?.supplier?._id ?? "");
  const [supplierGstin, setSupplierGstin] = useState(initialDraft?.supplierGstin ?? "");
  const [poId, setPoId] = useState(initialPo ?? initialDraft?.purchaseOrder ?? "");
  const [pos, setPos] = useState<Array<{ _id: string; poNo: number; status: string }>>([]);
  const { data: poInfo } = useBillPoInfo(poId || undefined);
  const [kind, setKind] = useState<"goods" | "service">(initialDraft?.billKind ?? "goods");
  const [category, setCategory] = useState(initialDraft?.category ?? "");
  const [supplierBillNo, setSupplierBillNo] = useState(initialDraft?.billNo ?? "");
  const [billDate, setBillDate] = useState(initialDraft?.billDate ?? today());
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineInput[]>(initialDraft?.lines.length ? initialDraft.lines : [blankLine(settings?.invoice?.defaultGstPercent ?? 5)]);
  const [inwards, setInwards] = useState<string[]>([]);
  const [itcEligible, setItcEligible] = useState(true);
  const [tds, setTds] = useState<{ applicable: boolean; section: string; rate: number | "" }>({ applicable: false, section: "194C", rate: 2 });
  const [notes, setNotes] = useState("");
  const [reverseCharge, setReverseCharge] = useState(!!initialDraft?.reverseCharge);
  // The three-way match: what the server found off the PO or the receipts.
  const [variance, setVariance] = useState<BillVariance | null>(null);
  const [varianceNote, setVarianceNote] = useState("");

  const sellerState = settings?.invoice?.stateCode || stateCodeFromGstin(settings?.gstin);
  const supplyType: SupplyType = supplierGstin && sellerState && stateCodeFromGstin(supplierGstin) !== sellerState ? "inter" : "intra";

  // The supplier's open POs, for the picker.
  useEffect(() => {
    if (!supplier) { setPos([]); return; }
    let live = true;
    supplierService.getById(supplier).then((s) => { if (live) setSupplierGstin(s.gstin ?? ""); }).catch(() => {});
    import("@/features/suppliers/api").then(({ poService }) => poService.list({ supplierId: supplier, limit: 50 }))
      .then((r) => { if (live) setPos(r.pos.map((p) => ({ _id: p._id, poNo: p.poNo as number, status: p.status }))); })
      .catch(() => {});
    return () => { live = false; };
  }, [supplier]);

  // A PO picked: its unbilled receipts become the lines.
  useEffect(() => {
    if (!poInfo) return;
    if (!supplier) { setSupplier(poInfo.po.supplier._id); setSupplierGstin(poInfo.po.supplier.gstin ?? ""); }
    if (poInfo.lines.length && !initialDraft?.lines.length) {
      setLines(poInfo.lines.map((l) => ({ rawMaterial: l.rawMaterial, description: l.description, hsn: l.hsn ?? "", unit: l.unit ?? "", quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent })));
      setInwards(poInfo.lines.flatMap((l) => l.inwards));
    }
  }, [poInfo, supplier, initialDraft]);

  // A service bill posts to its expense head; without one Tally gets it as a purchase.
  const needsHead = kind === "service" && !category;
  const ready = supplier && supplierBillNo.trim() && !needsHead && lines.every((l) => l.description.trim() && Number(l.rate) >= 0 && l.rate !== "");
  const flags = useFlags("bill", supplier ? { supplier, supplierBillNo, billDate, lines, itcEligible, scannedGstin: initialDraft?.supplierGstin || undefined } : null);
  const categoryOptions = useMemo(() => (categories ?? []).filter((c) => c.active !== false).map((c) => ({ value: c._id, label: c.name })), [categories]);

  const submit = () =>
    createBill.mutate(
      {
        supplier, supplierBillNo: supplierBillNo.trim(), billDate, dueDate: dueDate || undefined,
        purchaseOrder: poId || undefined, inwards: poId ? inwards : undefined, kind, category: category || undefined,
        lines, itcEligible, tds: { applicable: tds.applicable, section: tds.section, rate: Number(tds.rate) || 0 }, notes: notes.trim() || undefined,
        source: initialDraft?.aiSuggestion ? "scan" : undefined, aiSuggestion: initialDraft?.aiSuggestion ?? undefined,
        reverseCharge: reverseCharge || undefined, varianceNote: varianceNote.trim() || undefined,
      },
      {
        onSuccess: (bill) => { toast(`Bill ${bill.billNo} entered`, "success"); onDone(bill._id); },
        onError: (e) => {
          if (e instanceof ApiError && e.code === "BILL_VARIANCE") {
            setVariance((e.data?.details as BillVariance | undefined) ?? null);
            toast("The bill does not match the PO — say why below, then enter it", "info");
            return;
          }
          toast(e instanceof ApiError ? e.message : "Could not enter the bill", "error");
        },
      }
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <PartyPicker partyType="supplier" value={supplier} onChange={(id) => { setSupplier(id); setPoId(""); }} />
        <Select label="Against purchase order" value={poId} onChange={(e) => setPoId(e.target.value)} disabled={!supplier}
          options={pos.map((p) => ({ value: p._id, label: `PO #${p.poNo} · ${p.status}` }))} placeholder={supplier ? "None — a service or ad-hoc bill" : "Pick the supplier first"} />
        <Input label="Supplier's bill number *" value={supplierBillNo} onChange={(e) => setSupplierBillNo(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bill date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          <Input label="Due date" type="date" value={dueDate} placeholder="30 days" onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Select label="Kind" value={kind} onChange={(e) => setKind(e.target.value as "goods" | "service")} options={[{ value: "goods", label: "Goods (stock)" }, { value: "service", label: "Service / job work" }]} />
        <Select label={kind === "service" ? "Expense head *" : "Expense head (for a service bill)"} value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} placeholder={kind === "service" ? "Pick the head it posts to" : "None"}
          error={needsHead && supplier ? "A service bill needs its head — freight, job work, repairs…" : undefined} />
      </div>

      {poInfo && poInfo.inwards.length > 0 && (
        <div className="rounded-lg bg-ink-50 p-3 text-sm">
          <p className="font-medium">Receipts on PO #{poInfo.po.poNo}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink-500">
            {poInfo.inwards.map((i) => (
              <li key={i._id}>{formatDate(i.date)} · {i.material} {i.quantity} {i.unit}{i.lotNo ? ` · lot ${i.lotNo}` : ""}{i.billedOn ? ` · on ${i.billedOn}` : " · not billed"}</li>
            ))}
          </ul>
          {poInfo.lines.length === 0 && <p className="mt-1 text-status-warning">Every receipt on this PO is already billed.</p>}
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Lines</p>
          <StatusChip tone={supplyType === "inter" ? "info" : "neutral"}>{supplyType === "inter" ? "IGST — supplier in another state" : "CGST + SGST"}</StatusChip>
        </div>
        {!settings ? <Skeleton className="h-24 w-full" /> : <LinesEditor lines={lines} onChange={setLines} supplyType={supplyType} showMaterial />}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itcEligible} onChange={(e) => setItcEligible(e.target.checked)} /> Input credit can be claimed</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tds.applicable} onChange={(e) => setTds({ ...tds, applicable: e.target.checked })} /> TDS applies when paying</label>
        <label className="flex items-center gap-2 text-sm" title="The supplier charges no GST; we pay it to the government and claim it back (goods transport, legal fees)"><input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} /> Reverse charge: we pay the GST</label>
        {tds.applicable && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="Section" value={tds.section} onChange={(e) => setTds({ ...tds, section: e.target.value })} />
            <Input label="Rate %" type="number" step="0.01" value={tds.rate} onChange={(e) => setTds({ ...tds, rate: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
        )}
      </div>
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <FlagList flags={flags} />
      {variance && variance.lines.length > 0 && (
        <div role="alert" className="rounded-lg border border-status-warning/40 bg-status-warningBg p-3 text-sm">
          <p className="font-semibold text-status-warning">Off the PO or the receipts by ₹{money(variance.total)}</p>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-ink-500"><th className="text-left font-medium">Line</th><th className="text-right font-medium">PO rate</th><th className="text-right font-medium">Billed rate</th><th className="text-right font-medium">Received</th><th className="text-right font-medium">Billed</th><th className="text-right font-medium">Extra</th></tr></thead>
            <tbody>{variance.lines.map((l, i) => <tr key={i}><td>{l.description}</td><td className="text-right tabular-nums">{l.poRate ?? "—"}</td><td className="text-right tabular-nums">{l.billRate}{l.rateOffPercent ? ` (${l.rateOffPercent > 0 ? "+" : ""}${l.rateOffPercent}%)` : ""}</td><td className="text-right tabular-nums">{l.receivedQty ?? "—"}</td><td className="text-right tabular-nums">{l.billedQty}</td><td className="text-right tabular-nums">₹{money(l.amount)}</td></tr>)}</tbody>
          </table>
          <Input label="Why this bill is right *" value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} placeholder="e.g. Rate revised by phone on 2 July; 2 kg extra accepted" />
          <p className="mt-1 text-xs text-ink-500">Or correct the lines — or enter it as billed and raise a debit note for the difference.</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready || (!!variance?.lines.length && varianceNote.trim().length < 8)} loading={createBill.isPending}>Enter bill</Button>
      </div>
    </div>
  );
}
