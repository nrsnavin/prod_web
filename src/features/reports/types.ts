// Shared shapes for the Reports section. The backend returns a common
// envelope for every report — summary + columns + rows + series (+ an
// optional period comparison) — so one ReportShell can render them all.

export type Preset = "today" | "week" | "month" | "fy" | "custom";
export type ProductionGroupBy = "machine" | "shift" | "elastic" | "operator" | "day";

export interface ReportColumn {
  key: string;
  header: string;
  format?: "text" | "number" | "currency";
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

// The filter state shared by the filter bar and the query. groupBy is a
// plain string so one filter bar serves every report's own dimensions.
export interface ReportFilters {
  preset: Preset;
  from?: string; // yyyy-mm-dd, only when preset === "custom"
  to?: string;
  groupBy: string;
  compare: boolean;
}

// ── Dispatch & customer-sales report ──────────────────────────────
export type DispatchGroupBy = "customer" | "elastic" | "day";

export interface DispatchSummary {
  dcs: number;
  quantity: number;
  amount: number;
  customers: number;
  avgRate: number;
}

// Rows are keyed by their columns' `key`s (label/dcs/quantity/amount).
export type DispatchRow = { key: string | null; label: string } & Record<string, string | number | null>;

export interface DispatchReport {
  range: { from: string; to: string };
  groupBy: DispatchGroupBy;
  summary: DispatchSummary;
  columns: ReportColumn[];
  rows: DispatchRow[];
  series: { date: string; amount: number }[];
  seriesKey: string;
  comparison?: {
    range: { from: string; to: string };
    summary: DispatchSummary;
    delta: { amount: number; quantity: number; dcs: number; amountPct: number | null };
  };
  rangeLabel: string;
  preset: Preset;
}

// ── Order book & fulfillment report ───────────────────────────────
export type OrderBookGroupBy = "customer" | "status" | "supplyMonth";

export interface OrderBookSummary {
  orders: number;
  orderedQty: number;
  pendingQty: number;
  openOrders: number;
  completedOrders: number;
  overdueOrders: number;
  onTimePct: number | null;
  otdConsidered: number;
}

export type OrderBookRow = { key: string | null; label: string } & Record<string, string | number | null>;

export interface OrderBookReport {
  range: { from: string; to: string };
  groupBy: OrderBookGroupBy;
  summary: OrderBookSummary;
  columns: ReportColumn[];
  rows: OrderBookRow[];
  series: { date: string; quantity: number }[];
  seriesKey: string;
  comparison?: {
    range: { from: string; to: string };
    summary: OrderBookSummary;
    delta: { orders: number; orderedQty: number; orderedQtyPct: number | null };
  };
  rangeLabel: string;
  preset: Preset;
}

// ── Stock & purchases report ──────────────────────────────────────
export type StockGroupBy = "material" | "category" | "supplier";

export interface StockSummary {
  materials: number;
  stockValue: number;
  lowStock: number;
  pos: number;
  purchaseValue: number;
  pendingValue: number;
}

export type StockRow = { key: string | null; label: string; low?: boolean } & Record<string, string | number | boolean | null>;

export interface StockPurchasesReport {
  range: { from: string; to: string };
  groupBy: StockGroupBy;
  summary: StockSummary;
  columns: ReportColumn[];
  rows: StockRow[];
  series: { date: string; value: number }[];
  seriesKey: string;
  comparison?: {
    range: { from: string; to: string };
    summary: { pos: number; purchaseValue: number; pendingValue: number };
    delta: { purchaseValue: number; purchaseValuePct: number | null };
  };
  rangeLabel: string;
  preset: Preset;
}
