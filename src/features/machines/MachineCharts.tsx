import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { lazyChart } from "@/components/ui/LazyChart";
import { useMachineSpend, useProductionSeries } from "./hooks";

// ══════════════════════════════════════════════════════════════════
//  WHAT THIS LOOM MADE, AND WHAT IT COST TO KEEP
//
//  Two charts on one row, over the same months, on purpose. Either one
//  alone is close to meaningless:
//
//    • spending alone finds the machines that get serviced, which is
//      not the same as the machines that are a problem.
//    • output alone finds the busy machines, which is not the same as
//      the profitable ones.
//
//  Side by side they answer the question worth asking — is this loom
//  earning its keep — and they answer it by eye, without arithmetic.
//  A month where the orange bar is tall and the blue one is short is
//  the shape somebody should look at.
//
//  ── The months line up, including the empty ones ─────────────────
//  Both series come back with every month in the window, quiet ones
//  included. That matters more here than anywhere else in the app: two
//  charts that each skipped their own empty months would have
//  different x axes and could not be read against each other at all,
//  while still looking perfectly reasonable.
//
//  ── Verified shifts only ─────────────────────────────────────────
//  The production line is drawn from closed shifts. An unverified
//  shift's figures are the operator's own and are corrected at
//  verification, so including them would draw a line that quietly
//  rewrites itself days later.
// ══════════════════════════════════════════════════════════════════

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const metres = (n: number) => `${Math.round(n).toLocaleString("en-IN")} m`;

/** "2026-08" → "Aug 26" */
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const date = new Date(Number(y), Number(mo) - 1, 1);
  return `${date.toLocaleString("en-IN", { month: "short" })} ${y.slice(2)}`;
};

const Chart = lazyChart<{
  series: Array<Record<string, unknown>>;
  dataKey: string;
  colorIndex?: 0 | 1 | 2 | 3;
  format: (v: number) => string;
}>(() => import("@/features/reports/components/ReportBarChart"), "ReportBarChart", "h-60");

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-lg font-bold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}

export function MachineCharts({ machineId, days = 365 }: {
  machineId: string;
  days?: number;
}) {
  const production = useProductionSeries(machineId, days);
  const spend = useMachineSpend(machineId, days);

  const busy = production.isLoading || spend.isLoading;
  const broken = production.isError || spend.isError;

  if (busy) {
    return (
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-5"><Skeleton className="h-64 w-full" /></Card>
        <Card className="p-5"><Skeleton className="h-64 w-full" /></Card>
      </div>
    );
  }

  if (broken) {
    return (
      <Card className="mt-4 p-5">
        <ErrorState
          error={production.error ?? spend.error}
          what="this machine's history"
          onRetry={() => { production.refetch(); spend.refetch(); }}
        />
      </Card>
    );
  }

  const output = production.data;
  const money = spend.data?.spend;

  const productionSeries = (output?.series ?? []).map((m) => ({
    ...m, date: monthLabel(m.month),
  }));
  const spendSeries = (money?.series ?? []).map((m) => ({
    ...m, date: monthLabel(m.month),
  }));

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
            What it produced
          </h3>
          <div className="flex gap-5">
            <Figure label="Total" value={metres(output?.totalMeters ?? 0)} />
            <Figure label="Shifts" value={String(output?.totalShifts ?? 0)} />
          </div>
        </div>

        {(output?.totalMeters ?? 0) === 0 ? (
          <EmptyState
            title="No verified production yet"
            description="Output appears here once a shift on this machine has been verified."
          />
        ) : (
          <Chart
            series={productionSeries}
            dataKey="meters"
            colorIndex={0}
            format={metres}
          />
        )}
        <p className="mt-2 text-xs text-ink-400">
          Verified shifts only — an unverified figure is the operator's own and
          changes when it is checked.
        </p>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
            What it cost to keep
          </h3>
          <div className="flex gap-5">
            <Figure label="Total" value={rupees(money?.total ?? 0)} />
            <Figure label="Typical month" value={rupees(money?.typicalMonth ?? 0)} />
          </div>
        </div>

        {(money?.total ?? 0) === 0 ? (
          <EmptyState
            title="Nothing spent on this machine"
            description="Service costs and filed bills appear here."
          />
        ) : (
          <>
            <Chart
              series={spendSeries}
              dataKey="total"
              colorIndex={2}
              format={rupees}
            />
            {money && money.byType.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                {money.byType.map((t) => (
                  <li key={t.type}>
                    {t.type}{" "}
                    <span className="tabular-nums text-ink-900">{rupees(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="mt-2 text-xs text-ink-400">
          Typical month is the median. One rebuild should not become the figure
          you budget against.
        </p>
      </Card>
    </div>
  );
}

export default MachineCharts;
