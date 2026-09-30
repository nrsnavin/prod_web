import { toISODate } from "./components/FilterBar";
import { AnalyticsFilters } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A NUMBER NEEDS SOMETHING TO BE COMPARED WITH
//
//  "29,016 m" on its own cannot be judged: nobody knows whether it is a
//  good month. Each headline tile now says how it moved against the
//  period of the same length just before, which is the question a
//  manager glancing at a phone is actually asking.
// ══════════════════════════════════════════════════════════════════

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** The same number of days, ending the day before this range starts. */
export function previousPeriod(f: AnalyticsFilters): AnalyticsFilters {
  const start = parse(f.startDate);
  const end = parse(f.endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return { ...f, startDate: toISODate(prevStart), endDate: toISODate(prevEnd) };
}

export interface Change {
  /** Rounded percentage change, or null when there is nothing to compare. */
  pct: number | null;
  direction: "up" | "down" | "flat";
}

/**
 * Percentage change from `before` to `now`. Null when either is missing
 * or the earlier period was zero — "up ∞%" is not information.
 */
export function change(now: number | undefined, before: number | undefined): Change {
  if (now == null || before == null || before === 0) return { pct: null, direction: "flat" };
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return { pct, direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}
