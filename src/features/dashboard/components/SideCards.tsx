import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { rupeesCompact } from "@/core/format/money";
import type { DashboardOverview } from "../api";

// The two short summaries beside "Needs you": the looms right now, and
// where the money stands. Each figure links to the screen behind it.

const n = (v: number) => Math.round(v).toLocaleString("en-IN");

function Row({ label, value, sub, to }: { label: string; value: string; sub?: string; to?: string }) {
  const body = (
    <>
      <span className="text-sm text-ink-600">{label}</span>
      <span className="text-right">
        <span className="block text-sm font-semibold tabular-nums text-ink-900">{value}</span>
        {sub && <span className="block text-xs text-ink-400">{sub}</span>}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="-mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-ink-100/60">
      {body}
    </Link>
  ) : (
    <div className="flex items-start justify-between gap-3 py-1.5">{body}</div>
  );
}

export function FloorNowCard({ floor, loading, canOpen }: { floor?: DashboardOverview["floor"]; loading: boolean; canOpen: (p: string) => boolean }) {
  if (loading) return <Card className="p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 h-24 w-full" /></Card>;
  if (!floor) return null;
  const l = floor.looms;
  const idle = Math.max(0, l.total - l.running - l.loading - l.maintenance);
  const seg = [
    { key: "weaving", label: "Weaving", count: l.running, cls: "bg-status-success" },
    { key: "loading", label: "Being loaded", count: l.loading, cls: "bg-status-info" },
    { key: "maintenance", label: "Maintenance", count: l.maintenance, cls: "bg-status-warning" },
    { key: "idle", label: "Idle", count: idle, cls: "bg-ink-200" },
  ];
  const mt = floor.metres;
  return (
    <Card className="p-5" aria-labelledby="floor-now">
      <h2 id="floor-now" className="font-semibold">The floor now</h2>
      <div
        className="mt-3 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-ink-100"
        role="img"
        aria-label={seg.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(", ")}
      >
        {l.total > 0 && seg.filter((s) => s.count > 0).map((s) => (
          <span key={s.key} className={s.cls} style={{ width: `${(s.count / l.total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {seg.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-ink-600">
            <span className={`h-2 w-2 rounded-full ${s.cls}`} aria-hidden />
            {s.label}
            <span className="ml-auto font-semibold tabular-nums text-ink-900">{s.count}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-ink-100 pt-2">
        <Row
          label="Metres so far today"
          value={`${n(mt.today)} m`}
          sub={mt.perWorkingDay != null ? `${n(mt.perWorkingDay)} m a working day lately` : "No working day recorded yet"}
          to={canOpen("/production") ? "/production" : undefined}
        />
      </div>
    </Card>
  );
}

export function MoneyCard({ money, loading, canOpen }: { money?: DashboardOverview["money"]; loading: boolean; canOpen: (p: string) => boolean }) {
  if (loading) return <Card className="p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 h-24 w-full" /></Card>;
  if (!money) return null;
  const at = (p: string) => (canOpen(p) ? p : undefined);
  const s = money.sales;
  return (
    <Card className="p-5" aria-labelledby="money-now">
      <h2 id="money-now" className="font-semibold">Money</h2>
      <div className="mt-2 divide-y divide-ink-100">
        <Row
          label="To collect"
          value={rupeesCompact(money.receivable.total)}
          sub={money.receivable.overdue > 0 ? `${rupeesCompact(money.receivable.overdue)} overdue` : "Nothing overdue"}
          to={at("/accounts/collections")}
        />
        <Row
          label="To pay"
          value={rupeesCompact(money.payable.total)}
          sub={money.payable.dueThisWeek > 0 ? `${rupeesCompact(money.payable.dueThisWeek)} due this week` : "Nothing due this week"}
          to={at("/accounts/bills")}
        />
        <Row
          label="Invoiced this month"
          value={rupeesCompact(s.monthToDate)}
          sub={`${rupeesCompact(s.lastMonthSameDays)} by day ${s.throughDay} last month`}
          to={at("/invoices")}
        />
      </div>
    </Card>
  );
}
