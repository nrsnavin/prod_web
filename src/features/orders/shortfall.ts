import { ApiError } from "@/core/http/httpClient";
import type { StockShortfall } from "./types";

/**
 * Every short material named on an INSUFFICIENT_STOCK refusal.
 *
 * The server names them all under `details.shortfalls` (it used to stop
 * at the first, and forcing then drew down every one unseen); `shortfall`
 * is the first of them, and all an older server sends.
 */
export function shortfallsOf(e: unknown): StockShortfall[] {
  if (!(e instanceof ApiError)) return [];
  const all = (e.data?.details as { shortfalls?: StockShortfall[] } | undefined)?.shortfalls;
  if (Array.isArray(all) && all.length > 0) return all;
  const one = e.data?.shortfall as StockShortfall | undefined;
  return one ? [one] : [];
}
