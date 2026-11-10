import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FileSpreadsheet, FileText, Plus, Sheet, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { Condition, EngineDataset, FieldType, Period, Preset, RunResult } from "./api";

// ══════════════════════════════════════════════════════════════════
//  The pieces every report screen shares: the period, the filters, the
//  table with its totals, and the downloads.
// ══════════════════════════════════════════════════════════════════

export const PRESET_LABEL: Record<Preset, string> = {
  today: "Today", yesterday: "Yesterday", week: "This week", month: "This month", last_month: "Last month",
  quarter: "This quarter", fy: "This financial year", last_fy: "Last financial year", custom: "Pick dates",
};

export function PeriodPicker({ value, onChange, disabled }: { value: Period; onChange: (p: Period) => void; disabled?: boolean }) {
  if (disabled) return <p className="pb-2 text-sm text-ink-500">As on today</p>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select label="Period" aria-label="Period" value={value.preset} onChange={(e) => onChange({ ...value, preset: e.target.value as Preset })}
        options={(Object.keys(PRESET_LABEL) as Preset[]).map((p) => ({ value: p, label: PRESET_LABEL[p] }))} />
      {value.preset === "custom" && (
        <>
          <Input label="From" type="date" value={value.from ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <Input label="To" type="date" value={value.to ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}

const OPS_FOR: Record<FieldType, { value: string; label: string }[]> = {
  text: [{ value: "=", label: "is" }, { value: "!=", label: "is not" }, { value: "contains", label: "contains" }, { value: "starts", label: "starts with" }, { value: "in", label: "is one of" }, { value: "empty", label: "is empty" }, { value: "not empty", label: "is not empty" }],
  number: [{ value: ">", label: "over" }, { value: ">=", label: "at least" }, { value: "<", label: "under" }, { value: "<=", label: "at most" }, { value: "=", label: "equals" }, { value: "!=", label: "is not" }],
  money: [{ value: ">", label: "over" }, { value: ">=", label: "at least" }, { value: "<", label: "under" }, { value: "<=", label: "at most" }, { value: "=", label: "equals" }],
  date: [{ value: ">=", label: "on or after" }, { value: "<=", label: "on or before" }, { value: "=", label: "on" }],
};

/** Conditions as rows: field, how, value. A blank value is left out when run. */
export function FilterRows({ dataset, value, onChange }: { dataset: EngineDataset; value: Condition[]; onChange: (c: Condition[]) => void }) {
  const fields = dataset.fields;
  const set = (i: number, patch: Partial<Condition>) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      {value.map((c, i) => {
        const f = fields.find((x) => x.key === c.field) ?? fields[0];
        const ops = OPS_FOR[f.type];
        const needsValue = c.op !== "empty" && c.op !== "not empty";
        return (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <Select aria-label={`Filter ${i + 1} field`} value={c.field} onChange={(e) => { const nf = fields.find((x) => x.key === e.target.value)!; set(i, { field: nf.key, op: OPS_FOR[nf.type][0].value, value: "" }); }} options={fields.map((x) => ({ value: x.key, label: x.label }))} />
            <Select aria-label={`Filter ${i + 1} condition`} value={c.op} onChange={(e) => set(i, { op: e.target.value })} options={ops} />
            {needsValue && <Input aria-label={`Filter ${i + 1} value`} type={f.type === "date" ? "date" : f.type === "text" ? "text" : "number"} placeholder={c.op === "in" ? "A, B, C" : ""} value={String(c.value ?? "")} onChange={(e) => set(i, { value: e.target.value })} />}
            <Button type="button" size="sm" variant="ghost" aria-label={`Remove filter ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
          </div>
        );
      })}
      <Button type="button" size="sm" variant="ghost" onClick={() => { const f = fields.find((x) => x.type === "text") ?? fields[0]; onChange([...value, { field: f.key, op: OPS_FOR[f.type][0].value, value: "" }]); }}><Plus className="h-4 w-4" /> Add a filter</Button>
    </div>
  );
}

/** Only the conditions that say something: a value given, or empty / not empty. */
export const usable = (conds: Condition[]) => conds.filter((c) => c.op === "empty" || c.op === "not empty" || (c.value !== undefined && String(c.value).trim() !== ""));

export function formatCell(v: unknown, type: FieldType) {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "money") return `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === "number") return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return String(v);
}

export function Downloads({ onDownload, disabled }: { onDownload: (f: "xlsx" | "pdf" | "csv") => Promise<void>; disabled?: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (f: "xlsx" | "pdf" | "csv") => {
    setBusy(f);
    try { await onDownload(f); } catch (e) { toast(e instanceof Error ? e.message : "Could not download", "error"); } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={disabled} loading={busy === "xlsx"} onClick={() => go("xlsx")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
      <Button size="sm" variant="secondary" disabled={disabled} loading={busy === "pdf"} onClick={() => go("pdf")}><FileText className="h-4 w-4" /> PDF</Button>
      <Button size="sm" variant="ghost" disabled={disabled} loading={busy === "csv"} onClick={() => go("csv")}><Sheet className="h-4 w-4" /> CSV</Button>
    </div>
  );
}

/** The result: what it covers, the table (click a heading to sort), totals over every matching row. */
export function ResultView({ data, loading, error }: { data?: RunResult; loading?: boolean; error?: string | null }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    const list = data?.result.rows ?? [];
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const x = a[sort.key]; const y = b[sort.key];
      if (x === y) return 0;
      if (x == null || x === "") return 1;
      if (y == null || y === "") return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { numeric: true })) * sort.dir;
    });
  }, [data, sort]);
  if (error) return <p role="alert" className="rounded-lg bg-status-dangerBg p-3 text-sm text-status-danger">{error}</p>;
  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;
  const { columns, totals, rowCount, truncated } = data.result;
  const isNum = (t: FieldType) => t === "number" || t === "money";
  const hasTotals = Object.keys(totals).length > 0 && rowCount > 0;
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-500">
        <span className="font-medium text-ink-700">{data.rangeLabel}</span>
        {data.filterLine ? ` · ${data.filterLine}` : ""} · {rowCount.toLocaleString("en-IN")} row{rowCount === 1 ? "" : "s"}
        {truncated ? ` — showing the first ${data.result.rows.length.toLocaleString("en-IN")}; the downloads carry more` : ""}
      </p>
      <div className="max-h-[65vh] overflow-auto rounded-lg border border-ink-100">
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10 bg-ink-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 text-xs font-semibold text-ink-500 ${isNum(c.type) ? "text-right" : "text-left"}`}>
                  <button type="button" className="inline-flex items-center gap-1 hover:text-ink-800" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: isNum(c.type) ? -1 : 1 }))}>
                    {c.label}{sort?.key === c.key ? (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-ink-500">Nothing matches for this period and these filters.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-ink-100 even:bg-ink-50/40">
                {columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-3 py-1.5 ${isNum(c.type) ? "text-right tabular-nums" : ""}`}>{formatCell(r[c.key], c.type)}</td>)}
              </tr>
            ))}
          </tbody>
          {hasTotals && (
            <tfoot className="sticky bottom-0 bg-surface">
              <tr className="border-t-2 border-ink-200 font-semibold">
                {columns.map((c, i) => <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${isNum(c.type) ? "text-right tabular-nums" : ""}`}>{c.key in totals ? formatCell(totals[c.key], c.type) : i === 0 ? "Total" : ""}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
