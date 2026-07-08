import { useState } from "react";
import { Sun, Moon, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { DataTable, Column } from "@/components/ui/DataTable";
import { cn } from "@/components/ui/cn";
import { useProductionRange, useProductionShiftDetail } from "./hooks";
import { ProductionShiftSlice } from "./types";
import { presetRange, toISODate } from "@/features/analytics/components/FilterBar";

const sliceTone: Record<string, ChipTone> = {
  closed: "success",
  running: "info",
  open: "warning",
  none: "neutral",
};

function ShiftSlice({
  slice,
  label,
  icon,
  onOpen,
}: {
  slice: ProductionShiftSlice;
  label: string;
  icon: React.ReactNode;
  onOpen: (id: string) => void;
}) {
  if (!slice.exists) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-ink-100/50 px-3 py-2 text-sm text-ink-400">
        {icon} {label}: no plan
      </div>
    );
  }
  return (
    <button
      onClick={() => slice.shiftPlanId && onOpen(slice.shiftPlanId)}
      className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm hover:border-brand-500 transition-colors w-full"
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="tabular-nums">{(slice.production ?? 0).toLocaleString()} m</span>
      <span className="text-xs text-ink-400">
        {slice.machineCount ?? 0} mc · {slice.operatorCount ?? 0} op
      </span>
      <span className="ml-auto">
        <StatusChip tone={sliceTone[slice.statusSummary ?? "none"]}>
          {slice.statusSummary}
        </StatusChip>
      </span>
    </button>
  );
}

type DetailRow = {
  shiftDetailId: string;
  status: string;
  timerLabel: string;
  productionMeters: number;
  machine?: { machineID?: string } | null;
  employee?: { name?: string; department?: string } | null;
  job?: { jobNo?: number; status?: string } | null;
};

const detailColumns: Column<DetailRow>[] = [
  { key: "machine", header: "Machine", render: (d) => d.machine?.machineID ?? "—" },
  { key: "operator", header: "Operator", render: (d) => d.employee?.name ?? "—" },
  { key: "job", header: "Job", render: (d) => (d.job?.jobNo ? `J-${d.job.jobNo}` : "—") },
  { key: "timer", header: "Runtime", align: "right", render: (d) => d.timerLabel },
  {
    key: "prod",
    header: "Output (m)",
    align: "right",
    render: (d) => d.productionMeters.toLocaleString(),
  },
  {
    key: "status",
    header: "Status",
    render: (d) => <StatusChip tone={sliceTone[d.status] ?? "neutral"}>{d.status}</StatusChip>,
  },
];

function ShiftDetailModal({ shiftPlanId, onClose }: { shiftPlanId: string; onClose: () => void }) {
  const { data, isLoading } = useProductionShiftDetail(shiftPlanId);
  return (
    <Modal open onClose={onClose} title={data ? `${data.shift} shift · ${data.dateLabel}` : "Shift detail"} width="max-w-3xl">
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4 text-center">
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.totalProduction.toLocaleString()}</p>
              <p className="text-xs text-ink-400">meters</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.totalMachines}</p>
              <p className="text-xs text-ink-400">machines</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.totalOperators}</p>
              <p className="text-xs text-ink-400">operators</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.timerLabel}</p>
              <p className="text-xs text-ink-400">total runtime</p>
            </div>
          </div>
          <DataTable
            columns={detailColumns}
            rows={data.details}
            rowKey={(d) => d.shiftDetailId}
            emptyTitle="No entries"
          />
        </>
      )}
    </Modal>
  );
}

export function ProductionViewPage() {
  const [range, setRange] = useState(presetRange(6));
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useProductionRange(range.startDate, range.endDate);

  return (
    <>
      <PageHeader
        title="Production view"
        subtitle="Day-by-day output split across day and night shifts."
      />

      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        {[
          { label: "7D", days: 6 },
          { label: "14D", days: 13 },
          { label: "30D", days: 29 },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => setRange(presetRange(p.days))}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium",
              presetRange(p.days).startDate === range.startDate
                ? "bg-ink-900 text-white"
                : "bg-ink-100 text-ink-600 hover:text-ink-900"
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 text-sm ml-2">
          <input
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
            className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
          />
          <span className="text-ink-400">→</span>
          <input
            type="date"
            value={range.endDate}
            min={range.startDate}
            max={toISODate(new Date())}
            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
            className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
      </Card>

      {isError && (
        <p className="mb-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          {(error as Error).message}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {[...(data ?? [])].reverse().map((day) => (
            <Card key={day.date} className={cn("p-4", !day.hasData && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-28">
                  <p className="font-semibold">{day.dateLabel}</p>
                  <p className="text-xs text-ink-400">{day.dayOfWeek}</p>
                </div>
                <div className="grid flex-1 gap-2 sm:grid-cols-2 min-w-64">
                  <ShiftSlice
                    slice={day.dayShift}
                    label="Day"
                    icon={<Sun className="h-4 w-4 text-status-warning" />}
                    onOpen={setOpenPlan}
                  />
                  <ShiftSlice
                    slice={day.nightShift}
                    label="Night"
                    icon={<Moon className="h-4 w-4 text-ink-400" />}
                    onOpen={setOpenPlan}
                  />
                </div>
                <div className="text-right w-28">
                  <p className="text-lg font-bold tabular-nums">
                    {day.totalProduction.toLocaleString()}
                  </p>
                  <p className="text-xs text-ink-400">meters</p>
                </div>
              </div>
            </Card>
          ))}
          {(data?.length ?? 0) === 0 && (
            <Card className="p-8 text-center text-sm text-ink-400">
              <X className="h-6 w-6 mx-auto mb-2" /> No data in this range.
            </Card>
          )}
        </div>
      )}

      {openPlan && <ShiftDetailModal shiftPlanId={openPlan} onClose={() => setOpenPlan(null)} />}
    </>
  );
}
