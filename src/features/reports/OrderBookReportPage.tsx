import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
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
import { OrderBookReport, ReportFilters } from "./types";

// Recharts is 362 KB. Behind a lazy boundary it arrives with the
// chart rather than before the page can draw its heading.
const ReportBarChart = lazyChart<
  React.ComponentProps<typeof import("./components/ReportBarChart")["ReportBarChart"]>
>(() => import("./components/ReportBarChart"), "ReportBarChart", "h-60");

const GROUP_BY_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "status", label: "Status" },
  { value: "supplyMonth", label: "Supply month" },
];

const nf = (n: number | undefined) => (n ?? 0).toLocaleString("en-IN");

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: "danger" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={"mt-1 text-xl font-semibold tabular-nums " + (tone === "danger" && value !== "0" ? "text-status-danger" : "")}>
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
    <span className={up ? "text-status-success" : "text-status-danger"}>
      <Icon className="inline h-3 w-3" /> {up ? "+" : "−"}{nf(Math.abs(value))}
      {pct != null ? ` (${up ? "+" : ""}${pct}%)` : ""}
    </span>
  );
}

export function OrderBookReportPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({
    preset: "month",
    groupBy: "customer",
    compare: false,
  });
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const ready = filters.preset !== "custom" || (!!filters.from && !!filters.to);

  const { data, isLoading, isError, error } = useQuery<OrderBookReport>({
    queryKey: ["report", "order-book", filters],
    queryFn: () => reportsService.orderBook(filters),
    enabled: ready,
    placeholderData: (prev) => prev,
  });

  const s = data?.summary;
  const cmp = data?.comparison;

  const runExport = async (fmt: "csv" | "pdf") => {
    setExporting(fmt);
    try {
      await reportsService.download("/reports/order-book", "order-book-report", filters, fmt);
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
        title="Order book & fulfillment"
        subtitle={data ? `${data.rangeLabel} · ${nf(s?.orders)} orders · ${s?.onTimePct ?? "—"}% on time` : "Order intake, pending and on-time delivery"}
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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Orders" value={nf(s?.orders)} sub={cmp && <Delta value={cmp.delta.orders} />} />
        <Tile label="Ordered (m)" value={nf(s?.orderedQty)} sub={cmp && <Delta value={cmp.delta.orderedQty} pct={cmp.delta.orderedQtyPct} />} />
        <Tile label="Pending (m)" value={nf(s?.pendingQty)} />
        <Tile label="Open orders" value={nf(s?.openOrders)} />
        <Tile label="Overdue" value={nf(s?.overdueOrders)} tone="danger" />
        <Tile
          label="On-time delivery"
          value={s?.onTimePct == null ? "—" : `${s.onTimePct}%`}
          sub={<span className="text-ink-400">{nf(s?.otdConsidered)} dispatches</span>}
        />
      </div>

      <Card className="mb-4 p-5">
        <h3 className="mb-3 font-semibold">Daily order intake</h3>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (data?.series.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">No orders placed in this period.</p>
        ) : (
          <ReportBarChart
            series={data?.series ?? []}
            dataKey="quantity"
            colorIndex={3}
            format={(v: number) => `${nf(v)}`}
          />
        )}
      </Card>

      <ReportTable
        title={`By ${groupLabel.toLowerCase()}`}
        columns={data?.columns ?? []}
        rows={data?.rows ?? []}
        loading={isLoading}
        emptyText="No orders in this period."
      />
    </>
  );
}
