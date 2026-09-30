import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR, FIRST
//
//  The dashboard says "here's what's happening on the floor today" and
//  then showed four counts of paperwork. The three things a supervisor
//  actually opens it for are here, above everything else:
//
//    looms running     how much of the plant is earning right now
//    metres today      so far, with yesterday's total beside it
//    late orders       supply date passed, not yet delivered
//
//  Each links to the screen that explains it. A part the user's
//  department cannot open is left out, rather than linking into a
//  bounce.
// ══════════════════════════════════════════════════════════════════

export interface FloorCardProps {
  looms?: { running: number; maintenance: number; total: number; loading?: boolean };
  metres?: { today: number; yesterday: number; loading?: boolean };
  lateOrders?: { count: number | undefined; loading?: boolean };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

function Cell({
  to, label, children, loading, wide,
}: { to: string; label: string; children: React.ReactNode; loading?: boolean; wide?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(wide && "col-span-2 sm:col-span-1", "flex min-w-0 flex-col gap-1 rounded-lg p-3 -m-1 hover:bg-ink-100/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500")}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      {loading ? <Skeleton className="h-8 w-24" /> : children}
    </Link>
  );
}

export function FloorCard({ looms, metres, lateOrders }: FloorCardProps) {
  if (!looms && !metres && !lateOrders) return null;

  const pct = looms && looms.total > 0 ? Math.round((looms.running / looms.total) * 100) : 0;
  const maintPct = looms && looms.total > 0 ? Math.round((looms.maintenance / looms.total) * 100) : 0;
  const late = lateOrders?.count;

  return (
    <Card className="mb-4 p-4 sm:p-5">
      <h2 className="sr-only">The floor right now</h2>
      {/* Phone: looms across the top, metres and late orders side by side. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {looms && (
          <Cell to="/machines" label="Looms running" loading={looms.loading} wide>
            <p className="text-2xl font-bold tabular-nums text-ink-900">
              {looms.running}
              <span className="text-base font-medium text-ink-400"> of {looms.total}</span>
            </p>
            <div
              className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
              role="img"
              aria-label={`${looms.running} running, ${looms.maintenance} in maintenance, ${looms.total - looms.running - looms.maintenance} idle`}
            >
              <span className="bg-status-success" style={{ width: `${pct}%` }} />
              <span className="bg-status-warning" style={{ width: `${maintPct}%` }} />
            </div>
            <span className="text-xs text-ink-400">
              {pct}% of the plant{looms.maintenance > 0 ? ` · ${looms.maintenance} in maintenance` : ""}
            </span>
          </Cell>
        )}

        {metres && (
          <Cell to="/production" label="Metres today" loading={metres.loading}>
            <p className="text-2xl font-bold tabular-nums text-ink-900">
              {fmt(metres.today)}
              <span className="text-base font-medium text-ink-400"> m</span>
            </p>
            {/* No up/down arrow: today is a day in progress, and set
                against a whole yesterday it would read as a drop every
                morning. The figure is context, not a verdict. */}
            <span className="text-xs text-ink-400">So far · yesterday {fmt(metres.yesterday)} m</span>
          </Cell>
        )}

        {lateOrders && (
          <Cell to="/orders" label="Late orders" loading={lateOrders.loading}>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                late && late > 0 ? "text-status-danger" : "text-ink-900"
              )}
            >
              {late ?? "—"}
            </p>
            <span className="text-xs text-ink-400">
              {late === undefined ? "Not reported by this server" : late > 0 ? "Past their supply date" : "Everything on time"}
            </span>
          </Cell>
        )}
      </div>
    </Card>
  );
}
