import { ComponentType, Suspense, lazy } from "react";
import { Skeleton } from "./Skeleton";

// ══════════════════════════════════════════════════════════════════
//  THE CHART LIBRARY ARRIVES WITH THE CHART, NOT WITH THE PAGE
//
//  Recharts is 362 KB — three times the entire application chunk. It
//  was imported at the top of five report pages and the order analytics
//  panel, which means it was fetched, parsed and executed before any of
//  those pages could draw anything at all: the heading, the summary
//  figures and the table all waited behind a library none of them use.
//
//  On the order detail page that is close to pure waste. Most people
//  open an order to read its lines, not to look at a chart three
//  screens down — they paid for the library and never scrolled to it.
//
//  ── Why a skeleton and not nothing ───────────────────────────────
//  The reserved box is the point. Dropping the chart in when it arrives
//  would shove everything below it down the page, and on a slow
//  connection that happens seconds after somebody has started reading.
//  The placeholder holds the space so the layout never moves.
// ══════════════════════════════════════════════════════════════════

/**
 * Wraps a dynamic import in a lazy boundary with a shaped placeholder.
 *
 * @param loader   the dynamic import, e.g. `() => import("./Charts")`
 * @param name     the named export to render
 * @param height   the placeholder's height, matched to the real chart
 *                 so the page does not jump when it lands
 */
export function lazyChart<P extends object>(
  loader: () => Promise<Record<string, unknown>>,
  name: string,
  height = "h-64"
): ComponentType<P> {
  const Loaded = lazy(() =>
    loader().then((m) => ({ default: m[name] as ComponentType<Record<string, unknown>> }))
  );

  return function LazyChart(props: P) {
    return (
      <Suspense fallback={<Skeleton className={`w-full ${height}`} />}>
        <Loaded {...(props as Record<string, unknown>)} />
      </Suspense>
    );
  };
}
