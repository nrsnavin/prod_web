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
import { StockPurchasesReport, ReportFilters } from "./types";

const GROUP_BY_OPTIONS = [
  { value: "material", label: "Material" },
  { value: "category", label: "Category" },
  { value: "supplier", label: "Supplier" },
];

const nf = (n: number | undefined) => (n ?? 0).toLocaleString("en-IN");
const rupee = (n: number | undefined) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm shadow-card">
      <p className="font-medium">{label}</p>
      <p className="text-ink-600 tabular-nums">{rupee(payload[0].value)} purchased</p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: "danger" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={"mt-1 text-xl font-semibold tabular-nums " + (tone === "danger" && value !== "0" ? "text-red-600" : "")}>
        {value}
      </p>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </Card>
  );
}

function Delta({ value, pct }: { value: number; pct?: number | null }) {
  if (!value) return <span className="text-ink-400">no change</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={up ? "text-emerald-600" : "text-red-600"}>
      <Icon className="inline h-3 w-3" /> {up ? "+" : "−"}{rupee(Math.abs(value))}
      {pct != null ? ` (${up ? "+" : ""}${pct}%)` : ""}
    </span>
  );
}

export function StockPurchasesReportPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({
    preset: "month",
    groupBy: "material",
    compare: false,
  });
  const [exporting, setExporting] = useState(false);

  const ready = filters.preset !== "custom" || (!!filters.from && !!filters.to);

  const { data, isLoading, isError, error } = useQuery<StockPurchasesReport>({
    queryKey: ["report", "stock-purchases", filters],
    queryFn: () => reportsService.stockPurchases(filters),
    enabled: ready,
    placeholderData: (prev) => prev,
  });

  const s = data?.summary;
  const cmp = data?.comparison;

  const onExportCsv = async () => {
    setExporting(true);
    try {
      await reportsService.downloadCsv("/reports/stock-purchases", "stock-purchases-report", filters);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const groupLabel = GROUP_BY_OPTIONS.find((g) => g.value === filters.groupBy)?.label ?? "";

  return (
    <>
      <PageHeader
        title="Stock & purchases"
        subtitle={data ? `${data.rangeLabel} · ${rupee(s?.stockValue)} in stock` : "Raw-material valuation and purchases"}
      />

      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        groupByOptions={GROUP_BY_OPTIONS}
        onExportCsv={onExportCsv}
        onPrint={() => window.print()}
        exporting={exporting}
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Stock value" value={rupee(s?.stockValue)} sub={<span className="text-ink-400">as of now</span>} />
        <Tile label="Materials" value={nf(s?.materials)} />
        <Tile label="Low stock" value={nf(s?.lowStock)} tone="danger" sub={<span className="text-ink-400">at/below reorder</span>} />
        <Tile label="Purchases" value={rupee(s?.purchaseValue)} sub={cmp && <Delta value={cmp.delta.purchaseValue} pct={cmp.delta.purchaseValuePct} />} />
        <Tile label="Pending on PO" value={rupee(s?.pendingValue)} />
        <Tile label="POs" value={nf(s?.pos)} />
      </div>

      <Card className="mb-4 p-5">
        <h3 className="mb-3 font-semibold">Daily purchases (PO value)</h3>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (data?.series.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No purchase orders in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.series ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: chartTheme.axis }} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" fill={chartTheme.series[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <ReportTable
        title={`By ${groupLabel.toLowerCase()}`}
        columns={data?.columns ?? []}
        rows={data?.rows ?? []}
        loading={isLoading}
        emptyText="Nothing to show for this period."
      />

      {filters.groupBy !== "supplier" && (
        <p className="mt-2 text-xs text-ink-400">
          Stock value is a live snapshot (current stock × price) and ignores the date range; the
          range applies to the purchases figures and chart.
        </p>
      )}
    </>
  );
}
