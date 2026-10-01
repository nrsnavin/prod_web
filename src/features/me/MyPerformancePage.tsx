import { useState } from "react";
import { Gauge, Recycle, Ruler, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { KpiTile } from "@/features/dashboard/components/KpiTile";
import { formatDate } from "@/core/format/date";
import { cn } from "@/components/ui/cn";
import { useMyPerformance, useMyWastage } from "./hooks";
import { shiftName } from "./components";
import { MyShiftHistoryRow, MyWastage } from "./types";

// ══════════════════════════════════════════════════════════════════
//  HOW MY SHIFTS WENT
//
//  A worker's own numbers, each set against something that gives it
//  meaning: their previous period, and the plant's average shift. Then
//  every shift, and the wastage recorded against them.
// ══════════════════════════════════════════════════════════════════

const PERIODS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
];
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN"));
/** Six months of shifts is ~180 rows; on a phone that is a very long scroll. */
const HISTORY_STEP = 10;

const shiftColumns: Column<MyShiftHistoryRow>[] = [
  { key: "date", header: "Date", render: (r) => formatDate(r.date), sort: (r) => r.date, phone: "title" },
  { key: "shift", header: "Shift", render: (r) => shiftName(r.shift).replace(" shift", "") },
  { key: "loom", header: "Loom", render: (r) => r.machine ?? "—" },
  { key: "elastic", header: "Elastic", render: (r) => r.elastics.join(", ") || "—", cellClassName: "whitespace-normal" },
  { key: "metres", header: "Metres", align: "right", render: (r) => `${fmt(r.metres)} m`, sort: (r) => r.metres, phone: "badge" },
  { key: "mph", header: "m / hour", align: "right", render: (r) => fmt(r.metresPerHour), sort: (r) => r.metresPerHour ?? -1 },
];

const wastageColumns: Column<MyWastage>[] = [
  { key: "date", header: "Date", render: (w) => formatDate(w.incidentDate ?? w.createdAt), phone: "title" },
  { key: "job", header: "Job", render: (w) => (w.job ? `J-${w.job.jobOrderNo}` : "—") },
  { key: "elastic", header: "Elastic", render: (w) => w.elastic?.name ?? "—" },
  { key: "reason", header: "Reason", render: (w) => w.reason || "—", cellClassName: "whitespace-normal" },
  { key: "qty", header: "Metres", align: "right", render: (w) => `${fmt(w.quantity)} m`, phone: "badge" },
  { key: "penalty", header: "Penalty", align: "right", render: (w) => (w.penalty ? `₹${fmt(w.penalty)}` : "—") },
];

/** Metres per shift, oldest to newest, with the plant's average as a line. */
function ShiftBars({ rows, plantAvg }: { rows: MyShiftHistoryRow[]; plantAvg: number | null }) {
  const shown = rows.slice(0, 30).reverse();
  const max = Math.max(1, ...shown.map((r) => r.metres), plantAvg ?? 0);
  return (
    <figure>
      <div className="relative flex h-36 items-end gap-[3px]" role="img" aria-label={`Metres per shift for your last ${shown.length} shifts`}>
        {plantAvg != null && (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-400" style={{ bottom: `${(plantAvg / max) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[11px] text-ink-500">plant {fmt(plantAvg)} m</span>
          </div>
        )}
        {shown.map((r) => (
          <div
            key={r.id}
            title={`${formatDate(r.date)} · ${fmt(r.metres)} m`}
            className={cn("min-w-0 flex-1 rounded-t", plantAvg != null && r.metres < plantAvg ? "bg-status-warning/70" : "bg-status-success/80")}
            style={{ height: `${Math.max(2, (r.metres / max) * 100)}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-ink-500">
        Each bar is one shift, oldest on the left. Amber is below the plant's average shift.
      </figcaption>
    </figure>
  );
}

export function MyPerformancePage() {
  const [days, setDays] = useState("90");
  const [shown, setShown] = useState(HISTORY_STEP);
  const perf = useMyPerformance(Number(days));
  const wastage = useMyWastage();
  const s = perf.data?.summary;
  const vsPlant =
    s?.avgPerShift != null && s.plantAvgPerShift ? Math.round(((s.avgPerShift - s.plantAvgPerShift) / s.plantAvgPerShift) * 100) : null;
  const since = Date.now() - Number(days) * 86_400_000;
  const wastageInPeriod = (wastage.data ?? []).filter((w) => new Date(w.incidentDate ?? w.createdAt).getTime() >= since);
  const wastedMetres = wastageInPeriod.reduce((t, w) => t + (w.quantity || 0), 0);
  const penalties = wastageInPeriod.reduce((t, w) => t + (w.penalty || 0), 0);

  return (
    <>
      <PageHeader title="Performance" subtitle="Your shifts, against your own record and the plant's average." />
      <div className="mb-4">
        <FilterChips
          options={PERIODS}
          value={days}
          onChange={(v) => {
            setDays(v);
            setShown(HISTORY_STEP);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          label="Average per shift"
          value={s?.avgPerShift != null ? `${fmt(s.avgPerShift)} m` : "—"}
          icon={Ruler}
          loading={perf.isLoading}
          footer={s?.changePct != null ? `${s.changePct > 0 ? "▲" : s.changePct < 0 ? "▼" : "■"} ${Math.abs(s.changePct)}% on the period before` : "nothing to compare yet"}
        />
        <KpiTile
          label="Against the plant"
          value={vsPlant != null ? `${vsPlant > 0 ? "+" : ""}${vsPlant}%` : "—"}
          icon={Gauge}
          loading={perf.isLoading}
          footer={s?.plantAvgPerShift != null ? `plant ${fmt(s.plantAvgPerShift)} m a shift` : "no plant figure yet"}
        />
        <KpiTile
          label="Metres per hour"
          value={fmt(s?.metresPerHour)}
          icon={Timer}
          loading={perf.isLoading}
          footer={`${fmt(s?.totalMetres)} m over ${s?.shifts ?? 0} shifts`}
        />
        <KpiTile
          label="Wastage"
          value={`${fmt(wastedMetres)} m`}
          icon={Recycle}
          loading={wastage.isLoading}
          alert={wastedMetres > 0}
          footer={penalties ? `₹${fmt(penalties)} in penalties` : "no penalties"}
        />
      </div>

      <Card className="mt-4 p-5">
        <h2 className="mb-6 font-semibold">Metres per shift</h2>
        {perf.isLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : (perf.data?.shifts ?? []).length === 0 ? (
          <EmptyState compact title="No verified shifts in this period" description="A shift counts here once a supervisor has verified it." />
        ) : (
          <ShiftBars rows={perf.data!.shifts} plantAvg={s?.plantAvgPerShift ?? null} />
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="px-5 pt-5 font-semibold">Shift history</h2>
        <DataTable
          columns={shiftColumns}
          rows={(perf.data?.shifts ?? []).slice(0, shown)}
          rowKey={(r) => r.id}
          loading={perf.isLoading}
          error={perf.error}
          errorWhat="your shifts"
          compactEmpty
          emptyTitle="No verified shifts in this period"
        />
        {(perf.data?.shifts.length ?? 0) > shown && (
          <div className="border-t border-ink-100 p-3 text-center">
            <Button variant="ghost" onClick={() => setShown((n) => n + HISTORY_STEP * 2)}>
              Show more ({perf.data!.shifts.length - shown} older)
            </Button>
          </div>
        )}
      </Card>

      <Card className="mt-4" id="wastage">
        <h2 className="px-5 pt-5 font-semibold">Wastage</h2>
        <DataTable
          columns={wastageColumns}
          rows={wastageInPeriod}
          rowKey={(w) => w._id}
          loading={wastage.isLoading}
          error={wastage.error}
          errorWhat="your wastage"
          compactEmpty
          emptyTitle="No wastage recorded against you in this period"
        />
      </Card>
    </>
  );
}
