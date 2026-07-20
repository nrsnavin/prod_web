import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/core/http/httpClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath, effectiveDepartment } from "@/app/navigation";
import { useAnalytics } from "./hooks";
import { AnalyticsFilters } from "./types";
import { FilterBar, presetRange } from "./components/FilterBar";
import { ProductionTrendChart, WeeklyPatternChart, DayNightSplit } from "./components/charts";
import { MachineTable, EmployeeTable } from "./components/tables";
import { AnomaliesList } from "./components/AnomaliesList";
import { BreakdownPanel } from "./breakdown/BreakdownPanel";
import { ForecastPanel } from "./breakdown/ForecastPanel";

type Tab = "overview" | "breakdown" | "forecast" | "machines" | "operators" | "anomalies";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "breakdown", label: "Breakdown" },
  { key: "forecast", label: "Delivery forecast" },
  { key: "machines", label: "By machine" },
  { key: "operators", label: "By operator" },
  { key: "anomalies", label: "Anomalies" },
];

function StatTile({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-16" />
      ) : (
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      )}
    </Card>
  );
}

export function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    ...presetRange(29),
    shift: "all",
  });
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading, isError, error } = useAnalytics(filters);
  const s = data?.summary;
  const fmt = (n?: number) => (n ?? 0).toLocaleString("en-IN");

  // On-time delivery over the last 90 days (order-linked dispatches).
  // The endpoint lives under /dc (finance-area gate), so only fetch when
  // this user can access delivery challans — a weaving user opening
  // Analytics would otherwise fire a guaranteed 403.
  const { user } = useAuth();
  const canOtd = canAccessPath("/delivery-challans", effectiveDepartment(user));
  const otd = useQuery({
    queryKey: ["otd-stats"],
    queryFn: () =>
      httpClient.get<{ otdPct: number | null; considered: number; lateCount: number }>(
        "/dc/otd-stats",
        { days: 90 }
      ),
    enabled: canOtd,
  });

  return (
    <>
      <PageHeader
        title="Production analytics"
        subtitle="Output, efficiency and anomalies across machines and operators."
      />

      {tab !== "forecast" && <FilterBar filters={filters} onChange={setFilters} />}

      {isError && tab !== "forecast" && (
        <p className="mb-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          Couldn't load analytics: {(error as Error).message}
        </p>
      )}

      {/* Summary stat tiles — only for the production-summary tabs */}
      {tab !== "forecast" && tab !== "breakdown" && (
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Total production (m)" value={fmt(s?.totalProduction)} loading={isLoading} />
        <StatTile label="Shifts" value={fmt(s?.activeShifts)} loading={isLoading} />
        <StatTile label="Machines" value={fmt(s?.activeMachines)} loading={isLoading} />
        <StatTile label="Operators" value={fmt(s?.activeEmployees)} loading={isLoading} />
        <StatTile label="Avg / shift (m)" value={fmt(s?.avgPerShift)} loading={isLoading} />
        <StatTile label="Efficiency score" value={`${s?.avgEfficiencyScore ?? 0}`} loading={isLoading} />
        <StatTile label="Consistency" value={`${s?.factoryConsistency ?? 0}%`} loading={isLoading} />
        <StatTile label="Anomalies" value={fmt(s?.anomalyCount)} loading={isLoading} />
        {canOtd && (
          <StatTile
            label="On-time delivery (90d)"
            value={
              otd.data?.otdPct != null
                ? `${otd.data.otdPct}%`
                : otd.data
                  ? "—"
                  : "…"
            }
            loading={otd.isLoading}
          />
        )}
      </div>
      )}

      {/* Tabs */}
      <div className="mt-5 mb-4 flex gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-600 hover:text-ink-900"
            )}
          >
            {t.label}
            {t.key === "anomalies" && (s?.anomalyCount ?? 0) > 0 && (
              <StatusChip tone="danger" className="ml-2">
                {s?.anomalyCount}
              </StatusChip>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-semibold mb-3">Daily production trend</h3>
            {isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ProductionTrendChart data={data?.trend ?? []} />
            )}
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Weekly pattern (avg per weekday)</h3>
            {isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <WeeklyPatternChart data={data?.weeklyPattern ?? []} />
            )}
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Day vs night output</h3>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <DayNightSplit
                day={s?.dayVsNight.day ?? 0}
                night={s?.dayVsNight.night ?? 0}
              />
            )}
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-ink-400 text-xs">Total run time</p>
                <p className="font-semibold tabular-nums">
                  {Math.round((s?.totalRunMinutes ?? 0) / 60).toLocaleString("en-IN")} h
                </p>
              </div>
              <div>
                <p className="text-ink-400 text-xs">Overall avg (m/shift)</p>
                <p className="font-semibold tabular-nums">{fmt(s?.overallAvg)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "breakdown" && (
        <BreakdownPanel
          startDate={filters.startDate}
          endDate={filters.endDate}
          shift={filters.shift}
        />
      )}

      {tab === "forecast" && <ForecastPanel />}

      {tab === "machines" && (
        <Card className="py-2">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <MachineTable rows={data?.byMachine ?? []} />
          )}
        </Card>
      )}

      {tab === "operators" && (
        <Card className="py-2">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <EmployeeTable rows={data?.byEmployee ?? []} />
          )}
        </Card>
      )}

      {tab === "anomalies" && (
        <Card className="px-5 py-2">
          {isLoading ? (
            <div className="py-4 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <AnomaliesList items={data?.anomalies ?? []} />
          )}
        </Card>
      )}
    </>
  );
}
