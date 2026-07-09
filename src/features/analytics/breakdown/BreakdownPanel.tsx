import { useMemo, useState } from "react";
import { lazy, Suspense } from "react";
import { Cog, User, Building2, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Combobox } from "@/components/ui/Combobox";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { customerService } from "@/features/customers/api";
import { machineService } from "@/features/machines/api";
import { useBreakdown } from "./hooks";
import { GroupDim, BreakdownRow } from "./types";
import { InsightsList } from "./InsightsList";

const BreakdownBarChart = lazy(() =>
  import("./charts").then((m) => ({ default: m.BreakdownBarChart }))
);

const DIMS: { key: GroupDim; label: string; icon: typeof Cog }[] = [
  { key: "machine", label: "Machine", icon: Cog },
  { key: "operator", label: "Operator", icon: User },
  { key: "customer", label: "Customer", icon: Building2 },
  { key: "order", label: "Order", icon: ClipboardList },
];

const fmt = (n: number) => n.toLocaleString("en-IN");

export function BreakdownPanel({
  startDate,
  endDate,
  shift,
}: {
  startDate: string;
  endDate: string;
  shift: "all" | "day" | "night";
}) {
  const [groupBy, setGroupBy] = useState<GroupDim>("machine");
  const [customerId, setCustomerId] = useState("");
  const [machineId, setMachineId] = useState("");

  // Cross-filter option lists (cheap, cached).
  const customers = useQuery({
    queryKey: ["breakdown-customers"],
    queryFn: () => customerService.list({ limit: 200, page: 1 }),
    staleTime: 5 * 60_000,
  });
  const machines = useQuery({
    queryKey: ["breakdown-machines"],
    queryFn: () => machineService.list("all"),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isError, error } = useBreakdown({
    start: startDate,
    end: endDate,
    groupBy,
    shift: shift === "all" ? "all" : (shift.toUpperCase() as "DAY" | "NIGHT"),
    customerId: customerId || undefined,
    machineId: machineId || undefined,
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const columns: Column<BreakdownRow>[] = useMemo(
    () => [
      {
        key: "label",
        header: DIMS.find((d) => d.key === groupBy)?.label ?? "Name",
        render: (r) => (
          <div>
            <p className="font-medium text-ink-900">{r.label}</p>
            {r.sublabel && <p className="text-xs text-ink-400">{r.sublabel}</p>}
          </div>
        ),
        sort: (r) => r.label,
      },
      {
        key: "production",
        header: "Production (m)",
        align: "right",
        render: (r) => <span className="tabular-nums font-medium">{fmt(r.production)}</span>,
        sort: (r) => r.production,
      },
      {
        key: "share",
        header: "Share",
        align: "right",
        render: (r) => <span className="tabular-nums text-ink-600">{r.share}%</span>,
        sort: (r) => r.share,
      },
      {
        key: "shiftCount",
        header: "Shifts",
        align: "right",
        render: (r) => <span className="tabular-nums text-ink-600">{fmt(r.shiftCount)}</span>,
        sort: (r) => r.shiftCount,
      },
      {
        key: "avgPerShift",
        header: "Avg/shift",
        align: "right",
        render: (r) => <span className="tabular-nums text-ink-600">{fmt(r.avgPerShift)}</span>,
        sort: (r) => r.avgPerShift,
      },
      {
        key: "wastageQty",
        header: "Wastage (m)",
        align: "right",
        render: (r) => <span className="tabular-nums">{fmt(r.wastageQty)}</span>,
        sort: (r) => r.wastageQty,
      },
      {
        key: "wastageRate",
        header: "Wastage %",
        align: "right",
        render: (r) => (
          <StatusChip
            tone={r.wastageRate >= 5 ? "danger" : r.wastageRate >= 2 ? "warning" : "neutral"}
          >
            {r.wastageRate}%
          </StatusChip>
        ),
        sort: (r) => r.wastageRate,
      },
    ],
    [groupBy]
  );

  return (
    <div className="space-y-4">
      {/* Dimension + cross-filters */}
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1">
          {DIMS.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.key}
                onClick={() => setGroupBy(d.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  groupBy === d.key
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-600 hover:text-ink-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {d.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="w-52">
            <Combobox
              options={[
                { value: "", label: "All customers" },
                ...(customers.data?.customers ?? []).map((c) => ({
                  value: c._id,
                  label: c.name,
                })),
              ]}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Filter customer"
            />
          </div>
          <div className="w-44">
            <Combobox
              options={[
                { value: "", label: "All machines" },
                ...(machines.data ?? []).map((m) => ({
                  value: m._id,
                  label: `Machine ${m.ID ?? ""}`,
                })),
              ]}
              value={machineId}
              onChange={setMachineId}
              placeholder="Filter machine"
            />
          </div>
        </div>
      </Card>

      {isError && (
        <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          Couldn't load breakdown: {(error as Error).message}
        </p>
      )}

      {/* Totals strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TotalTile label="Production" value={`${fmt(totals?.production ?? 0)} m`} loading={isLoading} />
        <TotalTile label="Wastage" value={`${fmt(totals?.wastageQty ?? 0)} m`} loading={isLoading} />
        <TotalTile label="Wastage rate" value={`${totals?.wastageRate ?? 0}%`} loading={isLoading} />
        <TotalTile
          label="Penalty (₹)"
          value={fmt(Math.round(totals?.wastagePenalty ?? 0))}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 font-semibold">
            Production vs wastage by {DIMS.find((d) => d.key === groupBy)?.label.toLowerCase()}
          </h3>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
              <BreakdownBarChart rows={rows.slice(0, 12)} />
            </Suspense>
          )}
        </Card>
        <InsightsList items={data?.insights ?? []} loading={isLoading} />
      </div>

      <Card className="py-2">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          loading={isLoading}
          emptyTitle="No production in this range"
          emptyDescription="Adjust the date range, shift or filters above."
        />
      </Card>
    </div>
  );
}

function TotalTile({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-20" />
      ) : (
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      )}
    </Card>
  );
}
