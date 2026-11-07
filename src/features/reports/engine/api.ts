import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  The report engine (server: services/reportEngine): datasets with
//  their fields, ready-made reports, saved queries, and running any of
//  them as a table or a file.
// ══════════════════════════════════════════════════════════════════

export type FieldType = "text" | "number" | "money" | "date";
export interface EngineField { key: string; label: string; type: FieldType; agg: string | null }
export interface EngineDataset { id: string; label: string; description: string; dated: boolean; fields: EngineField[] }
export type Agg = "sum" | "count" | "countd" | "avg" | "min" | "max";
export interface Condition { field: string; op: string; value?: string | number | (string | number)[] }
export interface EngineQuery {
  dataset: string;
  select: (string | { field: string; agg?: Agg; as?: string })[];
  where?: Condition[];
  groupBy?: string[];
  orderBy?: { key: string; dir?: "asc" | "desc" }[];
  limit?: number | null;
}
export interface CatalogReport { id: string; group: string; title: string; description: string; query: EngineQuery; dated: boolean }
export interface SavedQuery { _id: string; name: string; query: EngineQuery; sql: string; preset: string; shared: boolean; createdByName?: string }
export interface Catalog { datasets: EngineDataset[]; reports: CatalogReport[]; saved: SavedQuery[]; presets: string[] }

export type Preset = "today" | "yesterday" | "week" | "month" | "last_month" | "quarter" | "fy" | "last_fy" | "custom";
export interface Period { preset: Preset; from?: string; to?: string }
export interface RunPayload { report?: string; query?: EngineQuery; sql?: string; title?: string; filters?: Condition[]; preset?: Preset; from?: string; to?: string }
export interface RunResult {
  title: string; rangeLabel: string; filterLine: string; query: EngineQuery;
  result: { dataset: string; datasetLabel: string; columns: { key: string; label: string; type: FieldType }[]; rows: Record<string, string | number | null>[]; totals: Record<string, number>; rowCount: number; truncated: boolean };
}

const withPeriod = (p: RunPayload) => {
  const out: RunPayload = { ...p };
  if (p.preset === "custom") { delete out.preset; } else { delete out.from; delete out.to; }
  return out;
};

export const engineService = {
  catalog: () => httpClient.get<Catalog & { success: boolean }>("/reports/catalog"),
  run: (payload: RunPayload) => httpClient.get<RunResult & { success: boolean }>("/reports/run", { payload: JSON.stringify(withPeriod(payload)) }),
  async download(payload: RunPayload, format: "xlsx" | "pdf" | "csv", fileBase: string) {
    const blob = await httpClient.getBlob("/reports/run", { payload: JSON.stringify({ ...withPeriod(payload), format }) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
  save: (body: { name: string; query?: EngineQuery; sql?: string; preset?: Preset; shared?: boolean }) => httpClient.post<{ saved: SavedQuery }>("/reports/saved", body),
  remove: (id: string) => httpClient.delete(`/reports/saved/${id}`),
};
