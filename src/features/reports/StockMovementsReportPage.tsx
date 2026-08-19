import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { reportsService } from "./api";
import { ReportFilterBar } from "./components/ReportFilterBar";
import { lazyChart } from "@/components/ui/LazyChart";
import { ReportTable } from "./components/ReportTable";
import { StockMovementsReport, ReportFilters } from "./types";

// Recharts is 362 KB. Behind a lazy boundary it arrives with the
// chart rather than before the page can draw its heading.
const ReportBarChart = lazyChart<
  React.ComponentProps<typeof import("./components/ReportBarChart")["ReportBarChart"]>
>(() => import("./components/ReportBarChart"), "ReportBarChart", "h-60");

const GROUP_BY_OPTIONS = [
  { value: "material", label: "Material" },
  { value: "day", label: "Day" },
];

const nf = (n: number | undefined) => (n ?? 0).toLocaleString("en-IN");

function Tile({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-status-success" : tone === "down" ? "text-status-danger" : "";
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={"mt-1 text-xl font-semibold tabular-nums " + color}>{value}</p>
    </Card>
  );
}

export function StockMovementsReportPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({
    preset: "month",
    groupBy: "material",
    compare: false,
  });
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const ready = filters.preset !== "custom" || (!!filters.from && !!filters.to);

  const { data, isLoading, isError, error } = useQuery<StockMovementsReport>({
    queryKey: ["report", "stock-movements", filters],
    queryFn: () => reportsService.stockMovements(filters),
    enabled: ready,
    placeholderData: (prev) => prev,
  });

  const s = data?.summary;

  const runExport = async (fmt: "csv" | "pdf") => {
    setExporting(fmt);
    try {
      await reportsService.download("/reports/stock-movements", "stock-movements-report", filters, fmt);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Export failed", "error");
    } finally {
      setExporting(null);
    }
  };

  const groupLabel = GROUP_BY_OPTIONS.find((g) => g.value === filters.groupBy)?.label ?? "";
  const net = s?.net ?? 0;

  return (
    <>
      <PageHeader
        title="Stock movement ledger"
        subtitle={data ? `${data.rangeLabel} · net ${net >= 0 ? "+" : ""}${nf(net)} kg` : "Raw-material in/out over a period"}
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
        <Tile label="Inward (kg)" value={nf(s?.inQty)} tone="up" />
        <Tile label="Outward (kg)" value={nf(s?.outQty)} tone="down" />
        <Tile label="Net (kg)" value={`${net >= 0 ? "+" : ""}${nf(net)}`} tone={net >= 0 ? "up" : "down"} />
        <Tile label="Receipts" value={nf(s?.inCount)} />
        <Tile label="Issues" value={nf(s?.outCount)} />
      </div>

      <Card className="mb-4 p-5">
        <h3 className="mb-3 font-semibold">Daily net movement</h3>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (data?.series.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No movements in this period.</p>
        ) : (
          <ReportBarChart
            series={data?.series ?? []}
            dataKey="net"
            signed
            format={(v: number) => `Net ${v >= 0 ? "+" : ""}${nf(v)} kg`}
          />
        )}
      </Card>

      <ReportTable
        title={`By ${groupLabel.toLowerCase()}`}
        columns={data?.columns ?? []}
        rows={data?.rows ?? []}
        loading={isLoading}
        emptyText="No movements in this period."
      />
    </>
  );
}
