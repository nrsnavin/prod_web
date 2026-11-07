import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Plus, Save, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { useToast } from "@/components/ui/Toast";
import { engineService, type Agg, type Condition, type EngineDataset, type EngineQuery, type Period, type RunResult } from "./api";
import { Downloads, FilterRows, PeriodPicker, ResultView, usable } from "./parts";

// ══════════════════════════════════════════════════════════════════
//  Build your own report: from dropdowns (what to report on, group by,
//  what to total, filters, sort) or as a simple SQL. Both run the same
//  way, download the same way, and can be saved.
// ══════════════════════════════════════════════════════════════════

interface Measure { field: string; agg: Agg }
const AGG_LABEL: Record<Agg, string> = { sum: "Total", count: "Count", countd: "Number of different", avg: "Average", min: "Lowest", max: "Highest" };

/** The dropdowns as a query. */
export function toQuery(dataset: string, groupBy: string[], measures: Measure[], columns: string[], filters: Condition[], sort: { key: string; dir: "asc" | "desc" } | null, limit: string): EngineQuery {
  const grouped = groupBy.length > 0 || measures.length > 0;
  return {
    dataset,
    select: grouped ? [...groupBy, ...measures.map((m) => ({ field: m.field, agg: m.agg }))] : columns.length ? columns : ["*"],
    groupBy: grouped ? groupBy : [],
    where: usable(filters),
    ...(sort?.key ? { orderBy: [sort] } : {}),
    ...(Number(limit) > 0 ? { limit: Number(limit) } : {}),
  };
}

/** A query as SQL, to start the SQL box from what was built. */
export function toSql(q: EngineQuery): string {
  const sel = q.select.map((s) => (typeof s === "string" ? s : s.agg === "countd" ? `COUNT(DISTINCT ${s.field})` : `${(s.agg ?? "").toUpperCase()}(${s.field})`)).join(", ");
  const lit = (v: unknown) => (typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
  const cond = (c: Condition) => {
    if (c.op === "empty") return `${c.field} IS NULL`;
    if (c.op === "not empty") return `${c.field} IS NOT NULL`;
    if (c.op === "contains") return `${c.field} LIKE ${lit(`%${c.value}%`)}`;
    if (c.op === "starts") return `${c.field} LIKE ${lit(`${c.value}%`)}`;
    if (c.op === "in" || c.op === "not in") { const list = Array.isArray(c.value) ? c.value : String(c.value).split(","); return `${c.field} ${c.op.toUpperCase()} (${list.map((v) => lit(typeof v === "string" ? v.trim() : v)).join(", ")})`; }
    if (c.op === "between" && Array.isArray(c.value)) return `${c.field} BETWEEN ${lit(c.value[0])} AND ${lit(c.value[1])}`;
    return `${c.field} ${c.op} ${lit(c.value)}`;
  };
  return [
    `SELECT ${sel}`, `FROM ${q.dataset}`,
    q.where?.length ? `WHERE ${q.where.map(cond).join(" AND ")}` : "",
    q.groupBy?.length ? `GROUP BY ${q.groupBy.join(", ")}` : "",
    q.orderBy?.length ? `ORDER BY ${q.orderBy.map((o) => `${o.key}${o.dir === "desc" ? " DESC" : ""}`).join(", ")}` : "",
    q.limit ? `LIMIT ${q.limit}` : "",
  ].filter(Boolean).join("\n");
}

export function QueryBuilderPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const location = useLocation();
  const [params] = useSearchParams();
  const catalog = useQuery({ queryKey: ["reports", "catalog"], queryFn: engineService.catalog, staleTime: 5 * 60_000 });
  const datasets = catalog.data?.datasets ?? [];

  const [mode, setMode] = useState<"build" | "sql">("build");
  const [datasetId, setDatasetId] = useState("");
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Condition[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [limit, setLimit] = useState("");
  const [sql, setSql] = useState("");
  const [period, setPeriod] = useState<Period>({ preset: "month" });
  const [title, setTitle] = useState("");
  const [data, setData] = useState<RunResult | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [shared, setShared] = useState(false);

  const dataset: EngineDataset | undefined = datasets.find((d) => d.id === datasetId) ?? datasets[0];

  /** Fill the dropdowns from a query (a ready-made report, or a saved one). */
  const load = (q: EngineQuery) => {
    setDatasetId(q.dataset);
    const g = q.groupBy ?? [];
    setGroupBy(g);
    setMeasures(q.select.filter((s): s is { field: string; agg: Agg } => typeof s !== "string" && !!s.agg).map((s) => ({ field: s.field, agg: s.agg })));
    setColumns(g.length ? [] : q.select.filter((s): s is string => typeof s === "string" && s !== "*"));
    setFilters(q.where ?? []);
    setSort(q.orderBy?.[0] ? { key: q.orderBy[0].key, dir: q.orderBy[0].dir ?? "asc" } : null);
    setLimit(q.limit ? String(q.limit) : "");
    setSql(toSql(q));
  };

  useEffect(() => {
    const st = location.state as { query?: EngineQuery; title?: string; period?: Period } | null;
    if (st?.query) { load(st.query); if (st.title) setTitle(st.title); if (st.period) setPeriod(st.period); return; }
    const savedId = params.get("saved");
    const saved = savedId ? catalog.data?.saved.find((s) => s._id === savedId) : null;
    if (saved) {
      setTitle(saved.name); setPeriod({ preset: (saved.preset as Period["preset"]) || "month" });
      if (saved.sql) { setMode("sql"); setSql(saved.sql); } else load(saved.query);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.data]);

  const built = useMemo(() => (dataset ? toQuery(dataset.id, groupBy, measures, columns, filters, sort, limit) : null), [dataset, groupBy, measures, columns, filters, sort, limit]);
  const payload = mode === "sql" ? { sql, title: title || "Query", ...period } : { query: built ?? undefined, title: title || "Query", ...period };

  const runIt = async () => {
    setRunning(true); setError(null);
    try { setData(await engineService.run(payload)); } catch (e) { setError(e instanceof Error ? e.message : "Could not run it"); setData(undefined); } finally { setRunning(false); }
  };
  const save = async () => {
    try {
      await engineService.save({ name: saveName, ...(mode === "sql" ? { sql } : { query: built! }), preset: period.preset, shared });
      qc.invalidateQueries({ queryKey: ["reports", "catalog"] });
      toast(`Saved as “${saveName}”`, "success"); setSaveName("");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save", "error"); }
  };

  if (!dataset) return <p className="text-sm text-ink-500">Loading…</p>;
  const fieldOpts = dataset.fields.map((f) => ({ value: f.key, label: f.label }));
  const numeric = dataset.fields.filter((f) => f.type === "number" || f.type === "money");
  const outputKeys = built ? (groupBy.length || measures.length ? [...groupBy, ...measures.map((m) => `${m.agg}_${m.field}`)] : columns.length ? columns : dataset.fields.map((f) => f.key)) : [];

  return (
    <>
      <Link to="/reports" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Reports</Link>
      <PageHeader title={title || "Build a report"} subtitle="Pick what to report on and how, or write it as SQL. It only reads — nothing can be changed from here."
        actions={<Downloads disabled={!data} onDownload={(f) => engineService.download(payload, f, `${title || "query"} ${data?.rangeLabel ?? ""}`)} />} />
      <Card className="mb-4 space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterChips options={[{ value: "build", label: "Build with dropdowns" }, { value: "sql", label: "Write SQL" }]} value={mode} onChange={(m) => { if (m === "sql" && built) setSql(toSql(built)); setMode(m as "build" | "sql"); }} />
          <PeriodPicker value={period} onChange={setPeriod} disabled={mode === "build" && !dataset.dated} />
        </div>

        {mode === "build" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Select label="Report on" value={dataset.id} onChange={(e) => { setDatasetId(e.target.value); setGroupBy([]); setMeasures([]); setColumns([]); setFilters([]); setSort(null); }} options={datasets.map((d) => ({ value: d.id, label: d.label }))} />
              <p className="self-end pb-2 text-sm text-ink-500">{dataset.description}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink-700">Group by</p>
                {groupBy.map((g, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <Select aria-label={`Group by ${i + 1}`} value={g} onChange={(e) => setGroupBy(groupBy.map((x, j) => (j === i ? e.target.value : x)))} options={fieldOpts} />
                    <Button size="sm" variant="ghost" aria-label={`Remove group ${i + 1}`} onClick={() => setGroupBy(groupBy.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setGroupBy([...groupBy, (dataset.fields.find((f) => f.type === "text" && !groupBy.includes(f.key)) ?? dataset.fields[0]).key])}><Plus className="h-4 w-4" /> Group by a column</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink-700">Totals</p>
                {measures.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <Select aria-label={`Total ${i + 1} kind`} value={m.agg} onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, agg: e.target.value as Agg } : x)))} options={(Object.keys(AGG_LABEL) as Agg[]).map((a) => ({ value: a, label: AGG_LABEL[a] }))} />
                    <Select aria-label={`Total ${i + 1} column`} value={m.field} onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} options={(m.agg === "count" || m.agg === "countd" ? dataset.fields : numeric).map((f) => ({ value: f.key, label: f.label }))} />
                    <Button size="sm" variant="ghost" aria-label={`Remove total ${i + 1}`} onClick={() => setMeasures(measures.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" disabled={!numeric.length} onClick={() => setMeasures([...measures, { agg: "sum", field: (numeric.find((f) => f.type === "money") ?? numeric[0]).key }])}><Plus className="h-4 w-4" /> Add a total</Button>
              </div>
            </div>
            {!groupBy.length && !measures.length && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink-700">Columns <span className="font-normal text-ink-400">(none ticked: all of them, row by row)</span></p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {dataset.fields.map((f) => (
                    <label key={f.key} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={columns.includes(f.key)} onChange={(e) => setColumns(e.target.checked ? [...columns, f.key] : columns.filter((c) => c !== f.key))} />{f.label}</label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink-700">Filters</p>
              <FilterRows dataset={dataset} value={filters} onChange={setFilters} />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Select label="Sort by" value={sort?.key ?? ""} onChange={(e) => setSort(e.target.value ? { key: e.target.value, dir: sort?.dir ?? "desc" } : null)} placeholder="Biggest value first" options={outputKeys.map((k) => ({ value: k, label: dataset.fields.find((f) => f.key === k)?.label ?? (() => { const [a, ...rest] = k.split("_"); const fl = dataset.fields.find((f) => f.key === rest.join("_"))?.label; return fl ? `${AGG_LABEL[a as Agg] ?? a} ${fl}` : k; })() }))} />
              {sort && <Select aria-label="Sort direction" value={sort.dir} onChange={(e) => setSort({ ...sort, dir: e.target.value as "asc" | "desc" })} options={[{ value: "desc", label: "High to low / Z–A" }, { value: "asc", label: "Low to high / A–Z" }]} />}
              <Input label="Top" type="number" min={1} className="w-24" placeholder="All" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-1">
              <label htmlFor="report-sql" className="text-sm font-medium text-ink-700">SQL</label>
              <textarea id="report-sql" rows={8} spellCheck={false} className="w-full rounded-lg border border-ink-200 p-2 font-mono text-sm" value={sql} onChange={(e) => setSql(e.target.value)}
                placeholder={"SELECT customer, SUM(taxable) AS sales\nFROM sales\nWHERE customer_group = 'Innerwear'\nGROUP BY customer\nORDER BY sales DESC\nLIMIT 20"} />
              <p className="text-xs text-ink-400">SELECT … FROM … WHERE … AND … GROUP BY … ORDER BY … LIMIT. SUM, COUNT, COUNT(DISTINCT …), AVG, MIN, MAX; =, !=, &lt;, &gt;, LIKE '%x%', IN (…), BETWEEN, IS NULL. A WHERE on date sets the period.</p>
            </div>
            <div className="max-h-72 overflow-auto rounded-lg bg-ink-50 p-2 text-xs">
              {datasets.map((d) => (
                <details key={d.id} open={sql.toLowerCase().includes(`from ${d.id}`)}>
                  <summary className="cursor-pointer font-mono font-semibold text-ink-700">{d.id}</summary>
                  <p className="mb-1 text-ink-500">{d.label}</p>
                  <ul className="mb-2 grid grid-cols-2 gap-x-2 font-mono text-ink-600">{d.fields.map((f) => <li key={f.key} title={f.label}>{f.key}</li>)}</ul>
                </details>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t border-ink-100 pt-3">
          <Button loading={running} onClick={runIt} disabled={mode === "sql" ? !sql.trim() : !built}><Play className="h-4 w-4" /> Run</Button>
          <Input label="Save as" placeholder="e.g. Innerwear sales by month" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
          <label className="flex items-center gap-1.5 pb-2 text-sm"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with others</label>
          <Button variant="secondary" disabled={!saveName.trim() || (mode === "sql" ? !sql.trim() : !built)} onClick={save}><Save className="h-4 w-4" /> Save</Button>
        </div>
      </Card>
      <ResultView data={data} loading={running} error={error} />
    </>
  );
}
