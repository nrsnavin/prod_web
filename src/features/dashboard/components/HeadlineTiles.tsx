import { Banknote, CalendarClock, Factory, Gauge, Receipt, Ruler, TrendingUp, Truck } from "lucide-react";
import { StatTile, type StatChange } from "@/components/ui/StatTile";
import { rupeesCompact } from "@/core/format/money";
import type { DashboardOverview } from "../api";

// ══════════════════════════════════════════════════════════════════
//  THE FOUR NUMBERS AT THE TOP
//
//  Chosen by role, each against something: a forecast, the days before,
//  last month to the same day. A figure that has not been recorded yet
//  says so instead of showing a zero.
//
//    owner        orders at risk · metres a working day · receivable · looms
//    production   orders at risk · metres a working day · looms · metres today
//    accounts     receivable · bills due this week · sales this month · orders at risk
// ══════════════════════════════════════════════════════════════════

const n = (v: number) => Math.round(v).toLocaleString("en-IN");

/** Percent change, or nothing when there is no fair comparison. */
export function changeAgainst(cur: number | null | undefined, prev: number | null | undefined, vs: string, higherIsBetter = true): StatChange | null {
  if (cur == null || prev == null || prev <= 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { pct, direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat", vs, higherIsBetter };
}

type Tile = "risk" | "metresPerDay" | "receivable" | "looms" | "metresToday" | "billsDue" | "sales";
const BY_ROLE: Record<DashboardOverview["role"], Tile[]> = {
  owner: ["risk", "metresPerDay", "receivable", "looms"],
  production: ["risk", "metresPerDay", "looms", "metresToday"],
  accounts: ["receivable", "billsDue", "sales", "risk"],
};

export function HeadlineTiles({
  data,
  loading,
  canOpen,
}: {
  data: DashboardOverview | undefined;
  loading: boolean;
  canOpen: (path: string) => boolean;
}) {
  // Until the role is known, the owner's layout holds the space.
  const tiles = BY_ROLE[data?.role ?? "owner"];
  const link = (to: string) => (canOpen(to) ? to : undefined);
  const f = data?.floor;
  const m = data?.money;
  const risk = data?.ordersAtRisk;

  const render = (t: Tile) => {
    switch (t) {
      case "risk":
        return (
          <StatTile
            key={t}
            label="Orders at risk"
            icon={CalendarClock}
            size="lg"
            loading={loading}
            to={link("/orders")}
            value={risk ? risk.count : "—"}
            tone={!risk ? "default" : risk.late > 0 ? "danger" : risk.count > 0 ? "warning" : "good"}
            sub={
              !risk
                ? undefined
                : risk.top
                  ? `Order #${risk.top.orderNo}: ${risk.top.detail}`
                  : "Every order is on course for its date"
            }
          />
        );
      case "metresPerDay": {
        const mt = f?.metres;
        return (
          <StatTile
            key={t}
            label="Metres a working day"
            icon={Ruler}
            size="lg"
            loading={loading}
            to={link("/production")}
            value={mt?.perWorkingDay != null ? n(mt.perWorkingDay) : "—"}
            unit={mt?.perWorkingDay != null ? "m" : undefined}
            change={changeAgainst(mt?.perWorkingDay, mt?.previousPerWorkingDay, `vs the ${mt?.previousDays ?? 12} working days before`)}
            sub={
              !mt
                ? undefined
                : mt.perWorkingDay == null
                  ? "Not recorded yet"
                  : `Average of the last ${mt.days} working day${mt.days === 1 ? "" : "s"}`
            }
            trend={mt?.series.map((d) => d.metres)}
            trendLabel="Metres each working day"
          />
        );
      }
      case "receivable":
        return (
          <StatTile
            key={t}
            label="To collect"
            icon={Banknote}
            size="lg"
            loading={loading}
            to={link("/accounts/collections")}
            value={m ? rupeesCompact(m.receivable.total) : "—"}
            tone={m && m.receivable.overdue > 0 ? "warning" : "default"}
            sub={
              !m
                ? undefined
                : m.receivable.overdue > 0
                  ? `${rupeesCompact(m.receivable.overdue)} overdue · ${m.receivable.overdueDocs} invoice${m.receivable.overdueDocs === 1 ? "" : "s"}`
                  : "Nothing overdue"
            }
          />
        );
      case "looms": {
        const l = f?.looms;
        const idle = l ? Math.max(0, l.total - l.running - l.loading - l.maintenance) : 0;
        const parts = l
          ? [l.loading && `${l.loading} being loaded`, l.maintenance && `${l.maintenance} in maintenance`, idle && `${idle} idle`].filter(Boolean)
          : [];
        return (
          <StatTile
            key={t}
            label="Looms weaving"
            icon={Factory}
            size="lg"
            loading={loading}
            to={link("/machines")}
            value={l ? l.running : "—"}
            unit={l ? `of ${l.total}` : undefined}
            sub={l ? (parts.length ? parts.join(" · ") : "Every loom is weaving") : undefined}
          />
        );
      }
      case "metresToday": {
        const mt = f?.metres;
        return (
          <StatTile
            key={t}
            label="Metres so far today"
            icon={Gauge}
            size="lg"
            loading={loading}
            to={link("/production")}
            value={mt ? n(mt.today) : "—"}
            unit={mt ? "m" : undefined}
            sub={mt?.perWorkingDay != null ? `A working day lately: ${n(mt.perWorkingDay)} m` : mt ? "No working day recorded yet" : undefined}
          />
        );
      }
      case "billsDue":
        return (
          <StatTile
            key={t}
            label="Bills due this week"
            icon={Truck}
            size="lg"
            loading={loading}
            to={link("/accounts/bills")}
            value={m ? rupeesCompact(m.payable.dueThisWeek) : "—"}
            sub={m ? `${m.payable.dueThisWeekDocs} bill${m.payable.dueThisWeekDocs === 1 ? "" : "s"} · ${rupeesCompact(m.payable.total)} owed in all` : undefined}
          />
        );
      case "sales":
        return (
          <StatTile
            key={t}
            label="Invoiced this month"
            icon={m && m.sales.monthToDate >= m.sales.lastMonthSameDays ? TrendingUp : Receipt}
            size="lg"
            loading={loading}
            to={link("/invoices")}
            value={m ? rupeesCompact(m.sales.monthToDate) : "—"}
            change={m ? changeAgainst(m.sales.monthToDate, m.sales.lastMonthSameDays, `vs the first ${m.sales.throughDay} days of last month`) : null}
            sub={m ? `${m.sales.invoices} invoice${m.sales.invoices === 1 ? "" : "s"}` : undefined}
          />
        );
    }
  };

  return <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{tiles.map(render)}</div>;
}
