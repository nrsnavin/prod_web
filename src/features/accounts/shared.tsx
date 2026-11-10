import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { quickCreate } from "@/features/common/quickCreateStore";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { customerService } from "@/features/customers/api";
import { supplierService } from "@/features/suppliers/api";
import { priceLines } from "@/features/invoices/gst";
import type { SupplyType } from "@/features/invoices/types";
import type { BillStatus, ExpenseStatus, LineInput } from "./types";

export { money, qty } from "@/features/invoices/gst";

export const billTone: Record<BillStatus, ChipTone> = { open: "warning", part_paid: "info", paid: "success", cancelled: "danger" };
export const billLabel: Record<BillStatus, string> = { open: "Open", part_paid: "Part paid", paid: "Paid", cancelled: "Cancelled" };
export const expenseTone: Record<ExpenseStatus, ChipTone> = { pending: "warning", approved: "info", rejected: "danger", paid: "success", cancelled: "neutral" };
export const expenseLabel: Record<ExpenseStatus, string> = { pending: "To approve", approved: "Approved", rejected: "Rejected", paid: "Paid", cancelled: "Cancelled" };

/** YYYY-MM-DD of the local date — toISOString() would give the UTC one, a day early before 05:30 in India. */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => ymd(new Date());
export const monthStart = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); };

/** Common periods, by the calendar here: the quarter and year are the financial ones (April to March). */
export function periods(now = new Date()): Array<{ key: string; label: string; from: string; to: string }> {
  const y = now.getFullYear(); const m = now.getMonth();
  const q0 = m - (((m - 3) % 3) + 3) % 3; // first month of the April-based quarter
  const fy = m >= 3 ? y : y - 1;
  return [
    { key: "month", label: "This month", from: ymd(new Date(y, m, 1)), to: today() },
    { key: "last", label: "Last month", from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) },
    { key: "quarter", label: "This quarter", from: ymd(new Date(y, q0, 1)), to: today() },
    { key: "fy", label: "This year", from: ymd(new Date(fy, 3, 1)), to: today() },
  ];
}

/** The period a report opens on: last month until the 10th — the first days go to closing it — then this month. */
export const defaultPeriod = (now = new Date()) => { const p = periods(now); const x = now.getDate() < 10 ? p[1] : p[0]; return { from: x.from, to: x.to }; };

/** A customer or supplier, searched on the server. */
export function PartyPicker({ partyType, value, onChange, label, disabled, knownName }: {
  partyType: "customer" | "supplier"; value: string; onChange: (id: string, name: string) => void; label?: string; disabled?: boolean;
  /** The chosen party's name when it arrives chosen (from an invoice, or ⌘K), so the box shows it at once. */
  knownName?: string;
}) {
  const names = useMemo(() => new Map<string, string>(), []);
  const load = async (query: string) => {
    if (partyType === "customer") {
      const res = await customerService.list({ page: 1, limit: 20, search: query });
      return res.customers.map((c) => { names.set(c._id, c.name); return { value: c._id, label: c.gstin ? `${c.name} · ${c.gstin}` : c.name }; });
    }
    const res = await supplierService.list({ page: 1, limit: 20, search: query });
    return res.suppliers.map((s) => { names.set(s._id, s.name); return { value: s._id, label: s.gstin ? `${s.name} · ${s.gstin}` : s.name }; });
  };
  return (
    <AsyncCombobox
      label={label ?? (partyType === "customer" ? "Customer" : "Supplier")}
      aria-label={label ?? (partyType === "customer" ? "Customer" : "Supplier")}
      value={value}
      onChange={(id) => onChange(id, names.get(id) ?? "")}
      loadOptions={load}
      seedOptions={value && knownName ? [{ value, label: knownName }] : undefined}
      placeholder={`Search ${partyType}s…`}
      // Not on file yet: add them here; the new name is known at once.
      onCreate={async (typed) => { const o = await quickCreate(partyType, typed); if (o) names.set(o.value, o.label); return o; }}
      createLabel={partyType}
      disabled={disabled}
    />
  );
}

export const blankLine = (gstPercent: number | "" = 5): LineInput => ({ description: "", hsn: "", unit: "", quantity: 1, rate: "", gstPercent });

/** The priced view of what the form will send, the way the server prices it. */
export function priceInputs(lines: LineInput[], supplyType: SupplyType) {
  return priceLines(
    lines.map((l, i) => ({ elastic: String(i), name: l.description, unit: l.unit ?? "", quantity: Number(l.quantity) || 0, rate: Number(l.rate) || 0, hsn: l.hsn ?? "", gstPercent: Number(l.gstPercent) || 0, dcNumbers: [], rateSource: "entered" as const })),
    supplyType
  );
}

/** Taxed lines with live totals; `supplyType` decides the split shown. */
export function LinesEditor({ lines, onChange, supplyType, showMaterial = false }: {
  lines: LineInput[]; onChange: (lines: LineInput[]) => void; supplyType: SupplyType; showMaterial?: boolean;
}) {
  const priced = priceInputs(lines, supplyType);
  const inter = supplyType === "inter";
  const set = (i: number, patch: Partial<LineInput>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-xs text-ink-500 font-medium">
              <th className="py-2 text-left font-medium">Description</th>
              <th className="py-2 text-left font-medium">HSN</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-left font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">GST %</th>
              <th className="py-2 text-right font-medium">Taxable</th>
              <th className="py-2 text-right font-medium">{inter ? "IGST" : "CGST+SGST"}</th>
              <th className="py-2 text-right font-medium">Amount</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {lines.map((l, i) => {
              const p = priced.lines[i];
              return (
                <tr key={i}>
                  <td className="py-1.5 pr-2 min-w-[12rem]">
                    <Input aria-label={`Line ${i + 1} description`} value={l.description} placeholder={showMaterial ? "Material or service" : "What for"} onChange={(e) => set(i, { description: e.target.value })} />
                  </td>
                  <td className="py-1.5 pr-2"><Input aria-label={`Line ${i + 1} HSN`} className="w-24" value={l.hsn ?? ""} onChange={(e) => set(i, { hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })} /></td>
                  <td className="py-1.5 pr-2"><Input aria-label={`Line ${i + 1} quantity`} type="number" step="0.001" min={0} className="w-24 text-right" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
                  <td className="py-1.5 pr-2"><Input aria-label={`Line ${i + 1} unit`} className="w-16" value={l.unit ?? ""} placeholder="kg" onChange={(e) => set(i, { unit: e.target.value })} /></td>
                  <td className="py-1.5 pr-2"><Input aria-label={`Line ${i + 1} rate`} type="number" step="0.01" min={0} className="w-28 text-right" value={l.rate} onChange={(e) => set(i, { rate: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
                  <td className="py-1.5 pr-2"><Input aria-label={`Line ${i + 1} GST %`} type="number" step="0.01" min={0} max={100} className="w-20 text-right" value={l.gstPercent} onChange={(e) => set(i, { gstPercent: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
                  <td className="py-1.5 text-right tabular-nums">{p.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="py-1.5 text-right tabular-nums">{(p.cgst + p.sgst + p.igst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="py-1.5 pl-2">
                    <Button type="button" size="sm" variant="ghost" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, k) => k !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...lines, blankLine(lines[lines.length - 1]?.gstPercent ?? 5)])}>
          <Plus className="h-4 w-4" /> Add line
        </Button>
        <dl className="w-64 text-sm" aria-label="Totals">
          <div className="flex justify-between"><dt className="text-ink-500">Taxable</dt><dd className="tabular-nums">{priced.totals.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</dd></div>
          {inter ? (
            <div className="flex justify-between"><dt className="text-ink-500">IGST</dt><dd className="tabular-nums">{priced.totals.igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</dd></div>
          ) : (
            <>
              <div className="flex justify-between"><dt className="text-ink-500">CGST</dt><dd className="tabular-nums">{priced.totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">SGST</dt><dd className="tabular-nums">{priced.totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</dd></div>
            </>
          )}
          {priced.totals.roundOff !== 0 && <div className="flex justify-between"><dt className="text-ink-500">Round off</dt><dd className="tabular-nums">{priced.totals.roundOff.toFixed(2)}</dd></div>}
          <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">₹{priced.totals.grand.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</dd></div>
        </dl>
      </div>
    </div>
  );
}

export function Chip({ tone, children }: { tone: ChipTone; children: string }) {
  return <StatusChip tone={tone}>{children}</StatusChip>;
}

/** A from/to pair for a report. */
export function RangePicker({ from, to, onChange, presets = true }: { from: string; to: string; onChange: (r: { from: string; to: string }) => void; presets?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input label="From" type="date" value={from} onChange={(e) => onChange({ from: e.target.value, to })} />
      <Input label="To" type="date" value={to} onChange={(e) => onChange({ from, to: e.target.value })} />
      {presets && (
        <div className="flex flex-wrap gap-1 pb-1" role="group" aria-label="Period">
          {periods().map((p) => (
            <button key={p.key} type="button" onClick={() => onChange({ from: p.from, to: p.to })}
              className={`rounded-md px-2 py-1 text-xs ${from === p.from && to === p.to ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-500 hover:bg-ink-50"}`}>{p.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
