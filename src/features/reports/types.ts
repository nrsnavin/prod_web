// Shared shapes for the Reports section. The backend returns a common
// envelope for every report — summary + columns + rows + series (+ an
// optional period comparison) — so one ReportShell can render them all.

export type Preset = "today" | "week" | "month" | "fy" | "custom";
export type ProductionGroupBy = "machine" | "shift" | "elastic" | "operator" | "day";

export interface ReportColumn {
  key: string;
  header: string;
}

export interface ProductionSummary {
  meters: number;
  shifts: number;
  activeMachines: number;
  machineDays: number;
  avgPerShift: number;
  wastageMeters: number;
  wastagePct: number;
  wastagePenalty: number;
}

export interface ProductionRow {
  key: string | null;
  label: string;
  meters: number;
  shifts: number;
  avgPerShift: number;
}

export interface SeriesPoint {
  date: string;
  meters: number;
}

export interface ProductionComparison {
  range: { from: string; to: string };
  summary: ProductionSummary;
  delta: {
    meters: number;
    shifts: number;
    wastageMeters: number;
    metersPct: number | null;
  };
}

export interface ProductionReport {
  range: { from: string; to: string };
  groupBy: ProductionGroupBy;
  summary: ProductionSummary;
  columns: ReportColumn[];
  rows: ProductionRow[];
  series: SeriesPoint[];
  comparison?: ProductionComparison;
  rangeLabel: string;
  preset: Preset;
}

// The filter state shared by the filter bar and the query.
export interface ReportFilters {
  preset: Preset;
  from?: string; // yyyy-mm-dd, only when preset === "custom"
  to?: string;
  groupBy: ProductionGroupBy;
  compare: boolean;
}
