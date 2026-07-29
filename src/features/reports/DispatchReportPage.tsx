import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { chartTheme } from "@/core/charts/theme";
import { ApiError } from "@/core/http/httpClient";
import { reportsService } from "./api";
import { ReportFilterBar } from "./components/ReportFilterBar";
import { ReportTable } from "./components/ReportTable";
import { DispatchReport, ReportFilters } from "./types";

const GROUP_BY_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "elastic", label: "Elastic" },
  { value: "day", label: "Day" },
];

const nf = (n: number | undefined) => (n ?? 0).toLocaleString("en-IN");
const rupee = (n: number | undefined) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm shadow-card">
      <p className="font-medium">{label}</p>
      <p className="text-ink-600 tabular-nums">{rupee(payload[0].value)}</p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </Card>
  );
}

function Delta({ value, pct, currency }: { value: number; pct?: number | null; currency?: boolean }) {
  if (!value) return <span className="text-ink-400">no change</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const shown = currency ? rupee(Math.abs(value)) : nf(Math.abs(value));
  return (
    <span className={up ? "text-status-success" : "text-status-danger"}>
      <Icon className="inline h-3 w-3" /> {up ? "+" : "−"}{shown}
      {pct != null ? ` (${up ? "+" : ""}${pct}%)` : ""}
    </span>
  );
}

export function DispatchReportPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({
    preset: "month",
    groupBy: "customer",
    compare: false,
  });
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const ready = filters.preset !== "custom" || (!!filters.from && !!filters.to);

  const { data, isLoading, isError, error } = useQuery<DispatchReport>({
    queryKey: ["report", "dispatch", filters],
    queryFn: () => reportsService.dispatch(filters),
    enabled: ready,
    placeholderData: (prev) => prev,
  });

  const s = data?.summary;
  const cmp = data?.comparison;

  const runExport = async (fmt: "csv" | "pdf") => {
    setExporting(fmt);
    try {
      await reportsService.download("/reports/dispatch", "dispatch-sales-report", filters, fmt);
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
        title="Dispatch & customer sales"
        subtitle={data ? `${data.rangeLabel} · ${rupee(s?.amount)} dispatched` : "Delivery-challan value over a period"}
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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Tile label="Dispatch value" value={rupee(s?.amount)} sub={cmp && <Delta value={cmp.delta.amount} pct={cmp.delta.amountPct} currency />} />
        <Tile label="Quantity" value={nf(s?.quantity)} sub={cmp && <Delta value={cmp.delta.quantity} />} />
        <Tile label="Challans" value={nf(s?.dcs)} sub={cmp && <Delta value={cmp.delta.dcs} />} />
        <Tile label="Customers" value={nf(s?.customers)} />
        <Tile label="Avg rate" value={rupee(s?.avgRate)} />
      </div>

      <Card className="mb-4 p-5">
        <h3 className="mb-3 font-semibold">Daily dispatch value</h3>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (data?.series.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No dispatches in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.series ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: chartTheme.axis }} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: chartTheme.cursor }} />
              <Bar dataKey="amount" fill={chartTheme.series[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <ReportTable
        title={`By ${groupLabel.toLowerCase()}`}
        columns={data?.columns ?? []}
        rows={data?.rows ?? []}
        loading={isLoading}
        emptyText="No dispatches in this period."
      />
    </>
  );
}
