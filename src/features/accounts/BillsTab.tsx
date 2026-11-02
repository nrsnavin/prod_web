import { useEffect, useMemo, useState } from "react";
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
import type { BillStatus, LineInput, SupplierBill } from "./types";

const columns: Column<SupplierBill>[] = [
  { key: "no", header: "Bill", render: (b) => <span className="font-medium">{b.billNo}</span> },
  { key: "supplier", header: "Supplier", render: (b) => b.supplierName },
  { key: "theirs", header: "Their no.", render: (b) => `${b.supplierBillNo} · ${formatDate(b.billDate)}` },
  { key: "po", header: "PO", render: (b) => (b.poNo != null ? `#${b.poNo}` : b.kind === "service" ? "Service" : "—") },
  { key: "amount", header: "Amount (₹)", align: "right", render: (b) => money(b.totals?.grand) },
  { key: "due", header: "Outstanding (₹)", align: "right", render: (b) => <span className={b.outstanding ? "font-semibold" : "text-ink-400"}>{money(b.outstanding)}</span> },
  { key: "dueDate", header: "Due", render: (b) => formatDate(b.dueDate) },
  { key: "status", header: "Status", render: (b) => <StatusChip tone={billTone[b.status]}>{billLabel[b.status]}</StatusChip> },
];

export function BillsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BillStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const createOpen = params.get("new") === "bill";
  const navigate = useNavigate();
  const { data, isLoading } = useBills({ page, status, search });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Bill no., supplier, their no., PO…" className="w-full max-w-xs" />
        <FilterChips
          options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "part_paid", label: "Part paid" }, { value: "paid", label: "Paid" }, { value: "cancelled", label: "Cancelled" }]}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
        />
        <Button className="ml-auto" onClick={() => setParams({ new: "bill" })}><Plus className="h-4 w-4" /> Enter bill</Button>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.bills ?? []} rowKey={(b) => b._id} onRowClick={(b) => navigate(`/accounts/bills/${b._id}`)} loading={isLoading}
          emptyTitle="No supplier bills yet" emptyDescription="Enter a bill against a purchase order's receipts, or a service bill." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      <FormScreen open={createOpen} onClose={() => setParams({})} title="Enter supplier bill" width="max-w-5xl">
        <BillForm onDone={(id) => { setParams({}); navigate(`/accounts/bills/${id}`); }} onCancel={() => setParams({})} />
      </FormScreen>
    </>
  );
}

/**
 * A supplier bill: against a purchase order (its unbilled receipts come
 * in as lines at the PO price) or a service bill with none.
 */
export function BillForm({ onDone, onCancel, initialPo }: { onDone: (id: string) => void; onCancel: () => void; initialPo?: string }) {
  const { toast } = useToast();
  const { createBill } = useAccountsMutations();
  const { data: settings } = useDocumentSettings();
  const { data: categories } = useCategories();
  const [supplier, setSupplier] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [poId, setPoId] = useState(initialPo ?? "");
  const [pos, setPos] = useState<Array<{ _id: string; poNo: number; status: string }>>([]);
  const { data: poInfo } = useBillPoInfo(poId || undefined);
  const [kind, setKind] = useState<"goods" | "service">("goods");
  const [category, setCategory] = useState("");
  const [supplierBillNo, setSupplierBillNo] = useState("");
  const [billDate, setBillDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineInput[]>([blankLine(settings?.invoice?.defaultGstPercent ?? 5)]);
  const [inwards, setInwards] = useState<string[]>([]);
  const [itcEligible, setItcEligible] = useState(true);
  const [tds, setTds] = useState<{ applicable: boolean; section: string; rate: number | "" }>({ applicable: false, section: "194C", rate: 2 });
  const [notes, setNotes] = useState("");

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
    if (poInfo.lines.length) {
      setLines(poInfo.lines.map((l) => ({ rawMaterial: l.rawMaterial, description: l.description, hsn: l.hsn ?? "", unit: l.unit ?? "", quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent })));
      setInwards(poInfo.lines.flatMap((l) => l.inwards));
    }
  }, [poInfo, supplier]);

  const ready = supplier && supplierBillNo.trim() && lines.every((l) => l.description.trim() && Number(l.rate) >= 0 && l.rate !== "");
  const categoryOptions = useMemo(() => (categories ?? []).filter((c) => c.active !== false).map((c) => ({ value: c._id, label: c.name })), [categories]);

  const submit = () =>
    createBill.mutate(
      {
        supplier, supplierBillNo: supplierBillNo.trim(), billDate, dueDate: dueDate || undefined,
        purchaseOrder: poId || undefined, inwards: poId ? inwards : undefined, kind, category: category || undefined,
        lines, itcEligible, tds: { applicable: tds.applicable, section: tds.section, rate: Number(tds.rate) || 0 }, notes: notes.trim() || undefined,
      },
      {
        onSuccess: (bill) => { toast(`Bill ${bill.billNo} entered`, "success"); onDone(bill._id); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not enter the bill", "error"),
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
        <Select label="Expense head (for a service bill)" value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} placeholder="None" />
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
        {tds.applicable && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="Section" value={tds.section} onChange={(e) => setTds({ ...tds, section: e.target.value })} />
            <Input label="Rate %" type="number" step="0.01" value={tds.rate} onChange={(e) => setTds({ ...tds, rate: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
        )}
      </div>
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready} loading={createBill.isPending}>Enter bill</Button>
      </div>
    </div>
  );
}
