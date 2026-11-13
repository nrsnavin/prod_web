import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileScan, Plus, Tags, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useMaterials } from "@/features/materials/hooks";
import { PaperPicker, ReadProblem } from "@/features/accounts/PaperReader";
import { priceListService } from "./api";
import type { PriceListResult, Supplier, SupplierRate } from "./types";

// ══════════════════════════════════════════════════════════════════
//  RATES A SUPPLIER QUOTED
//
//  Their price list or quotation, photographed or as the PDF they sent,
//  is read (api/priceListRoutes.js): each line is put against one of our
//  materials, the ones bought from them first, with the rate live for it
//  now and how far it moved. What is saved becomes the live rate for that
//  material from this supplier, and a purchase order line above it is
//  flagged on the PO form. The rate it replaces is kept, no longer live.
// ══════════════════════════════════════════════════════════════════

const rupees = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const SOURCE: Record<SupplierRate["source"], string> = { price_list: "price list", quotation: "quotation", manual: "typed in" };
const todayIso = () => new Date().toISOString().slice(0, 10);

export function SupplierRates({ supplier }: { supplier: Supplier }) {
  const rates = useQuery({ queryKey: ["supplier", "rates", supplier._id], queryFn: () => priceListService.rates(supplier._id) });
  const [dialog, setDialog] = useState<"read" | "type" | null>(null);
  const rows = rates.data ?? [];
  const today = todayIso();
  return (
    <Card className="mt-4 p-5" aria-label="Rates they quoted">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Tags className="h-4 w-4 text-brand-500" aria-hidden /> Rates they quoted</h3>
          <p className="text-sm text-ink-500">A purchase order line above these is flagged when it is raised.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDialog("type")}><Plus className="h-4 w-4" aria-hidden /> Type rates in</Button>
          <Button size="sm" onClick={() => setDialog("read")}><FileScan className="h-4 w-4" aria-hidden /> Read a price list or quotation</Button>
        </div>
      </div>
      {rates.isLoading ? <Skeleton className="mt-3 h-20 w-full" /> : rates.isError ? (
        <p className="mt-3 text-sm text-ink-400">Could not load their rates.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">No rates kept for {supplier.name} yet. Read their latest price list or quotation.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm" aria-label="Their live rates">
            <thead><tr className="border-y border-ink-200 text-xs font-medium uppercase tracking-wide text-ink-400"><th className="py-2 text-left">Material</th><th className="py-2 text-right">Rate (₹)</th><th className="py-2 text-left pl-3">From</th><th className="py-2 text-left">Good till</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => {
                const lapsed = !!r.validUntil && r.validUntil.slice(0, 10) < today;
                return (
                  <tr key={r._id}>
                    <td className="py-2">{r.materialName}{r.description && r.description !== r.materialName && <span className="block text-xs text-ink-400">“{r.description}”</span>}</td>
                    <td className="py-2 text-right tabular-nums">{rupees(r.rate)}{r.unit ? <span className="text-ink-400">/{r.unit}</span> : null}{r.gstPercent != null && <span className="block text-xs text-ink-400">+{r.gstPercent}% GST</span>}</td>
                    <td className="py-2 pl-3 text-ink-600">{SOURCE[r.source]}{r.ref ? ` ${r.ref}` : ""}{r.quotedOn ? <span className="block text-xs text-ink-400">{formatDate(r.quotedOn)}</span> : null}</td>
                    <td className="py-2">{r.validUntil ? (lapsed ? <StatusChip tone="warning">lapsed {formatDate(r.validUntil)}</StatusChip> : formatDate(r.validUntil)) : <span className="text-ink-400">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {dialog && <PriceListDialog supplier={supplier} read={dialog === "read"} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />}
    </Card>
  );
}

type Row = { include: boolean; description: string; rawMaterial: string; rate: number | ""; unit: string; gstPercent: number | ""; minQty: number | ""; candidates: PriceListResult["rows"][number]["candidates"]; current: PriceListResult["rows"][number]["current"]; change: number | null };
const blankRow = (): Row => ({ include: true, description: "", rawMaterial: "", rate: "", unit: "", gstPercent: "", minQty: "", candidates: [], current: null, change: null });

function PriceListDialog({ supplier, read: reading, onClose, onSaved }: { supplier: Supplier; read: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const materials = useMaterials({ search: "", category: "all", lowStock: false });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<PriceListResult | null>(null);
  const [rows, setRows] = useState<Row[]>(reading ? [] : [blankRow()]);
  const [source, setSource] = useState<SupplierRate["source"]>(reading ? "quotation" : "manual");
  const [ref, setRef] = useState("");
  const [quotedOn, setQuotedOn] = useState(reading ? "" : todayIso());
  const [validUntil, setValidUntil] = useState("");

  const allOptions = useMemo(() => (materials.data ?? []).map((m) => ({ value: m._id, label: `${m.name} (${m.category})` })), [materials.data]);
  // A line's best guesses first, then every material.
  const optionsFor = (r: Row) => {
    if (!r.candidates.length) return allOptions;
    const ids = new Set(r.candidates.map((c) => c.id));
    return [...r.candidates.map((c) => ({ value: c.id, label: c.name })), ...allOptions.filter((o) => !ids.has(o.value))];
  };

  const read = async (files: File[]) => {
    setBusy(true);
    try {
      const r = await priceListService.read(files, supplier._id);
      setResult(r);
      if (!r.read.problem) {
        setSource(r.read.kind === "price_list" ? "price_list" : "quotation");
        setRef(r.read.ref ?? ""); setQuotedOn(r.read.date ?? ""); setValidUntil(r.read.validUntil ?? "");
        setRows(r.rows.map((x) => ({ include: !!x.rawMaterial, description: x.description, rawMaterial: x.rawMaterial ?? "", rate: x.rate, unit: x.unit, gstPercent: x.gstPercent ?? "", minQty: x.minQty ?? "", candidates: x.candidates, current: x.current, change: x.change })));
      }
    } catch (e) { toast(e instanceof Error ? e.message : "Could not read the price list", "error"); }
    finally { setBusy(false); }
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include && r.rawMaterial && Number(r.rate) > 0);
  // The paper's GSTIN against this supplier's: a quotation from someone else, read here by mistake.
  const otherGstin = result?.read.supplierGstin && supplier.gstin && result.read.supplierGstin !== supplier.gstin.toUpperCase() ? result.read.supplierGstin : null;

  const save = async () => {
    setSaving(true);
    try {
      const out = await priceListService.save({
        supplier: supplier._id, source, ref: ref.trim() || undefined, quotedOn: quotedOn || undefined, validUntil: validUntil || undefined, aiSuggestion: result?.aiSuggestion ?? undefined,
        rows: chosen.map((r) => ({ rawMaterial: r.rawMaterial, rate: Number(r.rate), unit: r.unit || undefined, description: r.description || undefined, gstPercent: r.gstPercent === "" ? null : Number(r.gstPercent), minQty: r.minQty === "" ? null : Number(r.minQty) })),
      });
      toast(`${out.saved} rate${out.saved === 1 ? "" : "s"} kept${out.replaced ? `, ${out.replaced} older one${out.replaced === 1 ? "" : "s"} replaced` : ""}`, "success");
      qc.invalidateQueries({ queryKey: ["supplier", "rates", supplier._id] });
      onSaved();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not keep the rates", "error"); }
    finally { setSaving(false); }
  };

  const showRows = !reading || (!!result && !result.read.problem);
  return (
    <Modal open onClose={onClose} title={reading ? `Read ${supplier.name}'s price list` : `Rates from ${supplier.name}`} width="max-w-4xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        {reading && !result && (
          <>
            <p className="text-sm text-ink-600">Their price list or quotation: a photo or the PDF, up to four pages. Each line is put against one of our materials, the ones you buy from them first, with the rate you have for it now.</p>
            <PaperPicker label="Price list photo" max={4} busy={busy} onFiles={read} />
          </>
        )}
        {result?.read.problem && <ReadProblem>{result.read.problem === "not_a_price_list" ? "That does not look like a price list or a quotation." : "The paper could not be read. Try a sharper photo or the PDF."}</ReadProblem>}
        {otherGstin && <p role="alert" className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">The paper carries GSTIN {otherGstin}{result?.read.supplierName ? ` (${result.read.supplierName})` : ""}; {supplier.name}'s is {supplier.gstin}. Check it is theirs before keeping these rates.</p>}
        {showRows && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Select label="It is a" value={source} onChange={(e) => setSource(e.target.value as SupplierRate["source"])} options={[{ value: "quotation", label: "Quotation" }, { value: "price_list", label: "Price list" }, { value: "manual", label: "Rate agreed (typed)" }]} />
              <Input label="Their reference" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Q/118" />
              <Input label="Dated" type="date" value={quotedOn} onChange={(e) => setQuotedOn(e.target.value)} />
              <Input label="Good till" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="space-y-2" aria-label="Lines quoted">
              {rows.length === 0 && <p className="text-sm text-ink-400">No priced lines were read.</p>}
              {rows.length > 0 && (
                <div aria-hidden className="hidden grid-cols-[24px_minmax(0,1.4fr)_110px_80px_80px_32px] gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
                  <span /><span>Their line · our material</span><span>Rate (₹)</span><span>Unit</span><span>GST %</span><span />
                </div>
              )}
              {rows.map((r, i) => (
                <div key={i} className={`grid grid-cols-2 items-start gap-2 rounded-lg border border-ink-100 p-2 sm:grid-cols-[24px_minmax(0,1.4fr)_110px_80px_80px_32px] ${r.include ? "" : "opacity-60"}`}>
                  <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1 sm:h-10">
                    <input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} aria-label={`Keep line ${i + 1}`} />
                    <span className="truncate text-ink-500 sm:hidden">{r.description || `Line ${i + 1}`}</span>
                  </label>
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    {r.description && <p className="mb-1 hidden truncate text-xs text-ink-500 sm:block" title={r.description}>“{r.description}”</p>}
                    <Combobox aria-label={`Material for line ${i + 1}`} placeholder={materials.isLoading ? "Loading…" : "Which of our materials"} options={optionsFor(r)} value={r.rawMaterial} onChange={(v) => setRow(i, { rawMaterial: v, include: true })} />
                    {r.current && <p className="mt-1 text-xs text-ink-500">Now ₹{rupees(r.current.rate)}{r.current.unit ? `/${r.current.unit}` : ""}{r.current.ref ? ` (${r.current.ref})` : ""}{r.change != null && <> · <span className={r.change > 0 ? "text-status-danger" : "text-status-success"}>{r.change > 0 ? "+" : ""}{r.change}%</span></>}</p>}
                  </div>
                  {/* Labelled on a phone, where the column headings are not shown. */}
                  <div className="min-w-0"><span aria-hidden className="mb-1 block text-xs font-medium text-ink-400 sm:hidden">Rate ₹</span>
                    <Input aria-label={`Rate for line ${i + 1}`} type="number" min={0} step="0.01" placeholder="Rate ₹" value={r.rate} onChange={(e) => setRow(i, { rate: e.target.value === "" ? "" : Number(e.target.value) })} /></div>
                  <div className="min-w-0"><span aria-hidden className="mb-1 block text-xs font-medium text-ink-400 sm:hidden">Unit</span>
                    <Input aria-label={`Unit for line ${i + 1}`} placeholder="Unit" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} /></div>
                  <div className="min-w-0"><span aria-hidden className="mb-1 block text-xs font-medium text-ink-400 sm:hidden">GST %</span>
                    <Input aria-label={`GST for line ${i + 1}`} type="number" min={0} step="0.01" placeholder="GST %" value={r.gstPercent} onChange={(e) => setRow(i, { gstPercent: e.target.value === "" ? "" : Number(e.target.value) })} /></div>
                  <button type="button" className="grid h-10 w-10 place-items-center self-end rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger sm:self-start" aria-label={`Remove line ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}><Plus className="h-4 w-4" aria-hidden /> Add a line</Button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <span className="mr-auto text-sm text-ink-500">{chosen.length} of {rows.length} line{rows.length === 1 ? "" : "s"} to keep</span>
              {reading && <Button variant="secondary" onClick={() => { setResult(null); setRows([]); }}>Read another</Button>}
              <Button onClick={save} disabled={!chosen.length} loading={saving}>Keep these rates</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
