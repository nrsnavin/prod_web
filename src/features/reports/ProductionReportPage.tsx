import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { DataTable, Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { reportsService } from "./api";
import { ReportFilterBar } from "./components/ReportFilterBar";
import { lazyChart } from "@/components/ui/LazyChart";
import { ProductionReport, ProductionRow, ReportFilters } from "./types";

// Recharts is 362 KB. Behind a lazy boundary it arrives with the
// chart rather than before the page can draw its heading.
const ReportBarChart = lazyChart<
  React.ComponentProps<typeof import("./components/ReportBarChart")["ReportBarChart"]>
>(() => import("./components/ReportBarChart"), "ReportBarChart", "h-60");

const GROUP_BY_OPTIONS = [
  { value: "machine", label: "Machine" },
  { value: "shift", label: "Shift" },
  { value: "elastic", label: "Elastic" },
  { value: "operator", label: "Operator" },
  { value: "day", label: "Day" },
];

const nf = (n: number | undefined) => (n ?? 0).toLocaleString("en-IN");

function Tile({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </Card>
  );
}

function Delta({ value, pct, invert }: { value: number; pct?: number | null; invert?: boolean }) {
  if (!value) return <span className="text-ink-400">no change</span>;
  const up = value > 0;
  // For "good" metrics (production) up is positive; for wastage, invert.
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={good ? "text-status-success" : "text-status-danger"}>
      <Icon className="inline h-3 w-3" /> {up ? "+" : ""}{nf(value)}
      {pct != null ? ` (${up ? "+" : ""}${pct}%)` : ""}
    </span>
  );
}

const columns: Column<ProductionRow>[] = [
  { key: "label", header: "", render: (r) => <span className="font-medium">{r.label}</span> },
  { key: "meters", header: "Meters", render: (r) => <span className="tabular-nums">{nf(r.meters)}</span> },
  { key: "shifts", header: "Shifts", render: (r) => <span className="tabular-nums">{r.shifts}</span> },
  { key: "avg", header: "Avg / shift", render: (r) => <span className="tabular-nums">{nf(r.avgPerShift)}</span> },
];

export function ProductionReportPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({
    preset: "month",
    groupBy: "machine",
    compare: false,
  });
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  // Custom range needs both ends before we query.
  const ready = filters.preset !== "custom" || (!!filters.from && !!filters.to);

  const { data, isLoading, isError, error } = useQuery<ProductionReport>({
    queryKey: ["report", "production", filters],
    queryFn: () => reportsService.production(filters),
    enabled: ready,
    placeholderData: (prev) => prev,
  });

  const s = data?.summary;
  const cmp = data?.comparison;

  const runExport = async (fmt: "csv" | "pdf") => {
    setExporting(fmt);
    try {
      await reportsService.download("/reports/production", "production-report", filters, fmt);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Export failed", "error");
    } finally {
      setExporting(null);
    }
  };

  const groupLabel = GROUP_BY_OPTIONS.find((g) => g.value === filters.groupBy)?.label ?? "";

  return (
    <>
      <PageHeader
        title="Production report"
        subtitle={data ? `${data.rangeLabel} · ${nf(s?.meters)} m produced` : "Meters produced over a period"}
      />

      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        groupByOptions={GROUP_BY_OPTIONS}
        onExportCsv={() => runExport("csv")}
        onExportPdf={() => runExport("pdf")}
        exporting={exporting}
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      {/* Summary tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Meters produced" value={nf(s?.meters)} sub={cmp && <Delta value={cmp.delta.meters} pct={cmp.delta.metersPct} />} />
        <Tile label="Shifts" value={nf(s?.shifts)} sub={cmp && <Delta value={cmp.delta.shifts} />} />
        <Tile label="Avg / shift" value={nf(s?.avgPerShift)} />
        <Tile label="Machine-days" value={nf(s?.machineDays)} />
        <Tile label="Wastage (m)" value={nf(s?.wastageMeters)} sub={cmp && <Delta value={cmp.delta.wastageMeters} invert />} />
        <Tile label="Wastage %" value={`${s?.wastagePct ?? 0}%`} />
      </div>

      {/* Daily trend */}
      <Card className="mb-4 p-5">
        <h3 className="mb-3 font-semibold">Daily output</h3>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (data?.series.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No production in this period.</p>
        ) : (
          <ReportBarChart
            series={data?.series ?? []}
            dataKey="meters"
            colorIndex={0}
            format={(v: number) => `${nf(v)} m`}
          />
        )}
      </Card>

      {/* Group-by breakdown */}
      <Card>
        <div className="border-b border-ink-100 px-5 py-3">
          <h3 className="font-semibold">By {groupLabel.toLowerCase()}</h3>
        </div>
        <DataTable
          columns={columns.map((c, i) => (i === 0 ? { ...c, header: groupLabel } : c))}
          rows={data?.rows ?? []}
          rowKey={(r) => String(r.key ?? r.label)}
          loading={isLoading}
          emptyTitle="No production"
          emptyDescription="Nothing was produced in this period."
        />
      </Card>

      {filters.groupBy === "elastic" && (data?.rows.length ?? 0) > 0 && (
        <p className="mt-2 text-xs text-ink-400">
          Elastic output is apportioned across the heads running each shift; shifts with no
          recorded elastic mix aren't attributed here but still count in the totals above.
        </p>
      )}
    </>
  );
}
