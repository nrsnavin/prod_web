import type { Query } from "@tanstack/react-query";

// ══════════════════════════════════════════════════════════════════
//  HOW OFTEN EACH KIND OF DATA IS RE-FETCHED
//
//  Every query in the app used to poll every 10 s — a global default,
//  inherited by about 150 hooks. Right for a loom's running meters,
//  wasteful for a customer's address, and in one case expensive: the
//  machine AI diagnosis sets staleTime 5 min, but an interval refetches
//  whatever the staleness, so an open diagnosis panel called the
//  language model every ten seconds for as long as it stayed on screen.
//
//  Freshness is now decided per KIND of data, by the first element of
//  the query key, in one place:
//
//    live    10 s   the shop floor, which changes minute to minute
//    warm    60 s   business records other people change during the day
//    static  never  masters, settings, reports and anything AI-backed;
//                   refetched when the tab regains focus instead
//
//  A key not listed is `warm` — it still refreshes, just not six times a
//  minute. A query that sets its own refetchInterval keeps it.
// ══════════════════════════════════════════════════════════════════

export type Freshness = "live" | "warm" | "static";

const LIVE: ReadonlySet<string> = new Set([
  "dashboard",
  "shifts", "shift-detail", "production",
  "machines", "machine-issues", "machine-anomalies", "running-eta",
  "jobs", "job",
  "warpings", "warping-batches", "coverings", "packing",
  "attendance", "attendance-active",
  // The employee view: their shift can be verified or reassigned any time.
  "my-today",
]);

const STATIC: ReadonlySet<string> = new Set([
  // masters and settings
  "customers", "elastics", "elastic-groups", "material-groups",
  "suppliers", "supplier", "supplier-options", "users", "me", "session",
  "document-settings", "notify-settings", "pdf-template", "pdf-doc-types",
  "materials-by-category", "employees-by-dept",
  // search runs when the user types, never on a timer
  "global-search",
  // monthly figures, recomputed on demand
  "payroll", "payroll-employees", "payroll-range", "payslip", "bonus", "pnl",
  // reports, analytics and AI — expensive to compute, some call a model
  "report", "otd-stats", "quote-win-loss", "qc-root-cause", "complaint-themes",
  "staffing-forecast", "forecast-orders", "forecast-etas", "eta-risks",
  "group-breakdown", "machine-health", "machine-health-advice",
  "warp-optimize", "reorder-suggestions", "planner",
  // The employee view's settled records.
  // (Leave is not here: a worker waiting on a request should see it
  // approved without reloading, so it refreshes like other warm data.)
  "my-elastic", "my-profile", "my-payslip", "my-attendance",
]);

export const INTERVAL_MS: Record<Freshness, number | false> = {
  live: 10_000,
  warm: 60_000,
  static: false,
};

export function freshnessOf(queryKey: readonly unknown[]): Freshness {
  const head = typeof queryKey[0] === "string" ? queryKey[0] : "";
  if (LIVE.has(head)) return "live";
  if (STATIC.has(head)) return "static";
  return "warm";
}

type AnyQuery = Pick<Query, "queryKey">;

/** For defaultOptions.queries.refetchInterval. */
export const refetchIntervalFor = (query: AnyQuery): number | false =>
  INTERVAL_MS[freshnessOf(query.queryKey)];

/**
 * For defaultOptions.queries.refetchOnWindowFocus. Anything not polled
 * catches up when the user comes back to the tab; live data is already
 * polling, so a focus refetch would only double it.
 */
export const refetchOnFocusFor = (query: AnyQuery): boolean =>
  freshnessOf(query.queryKey) !== "live";
