import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMrp } from "./hooks";
import { jobService } from "./api";
import { MrpData } from "./types";

type MrpMaterial = MrpData["materials"][number];

const materialColumns: Column<MrpMaterial>[] = [
  {
    key: "name",
    header: "Raw material",
    render: (m) => <span className="font-medium">{m.name ?? m.materialName ?? "—"}</span>,
  },
  { key: "cat", header: "Category", render: (m) => m.category ?? "—" },
  {
    key: "required",
    header: "Required",
    align: "right",
    render: (m) => (m.required ?? m.quantity ?? 0).toLocaleString(),
  },
  {
    key: "stock",
    header: "In stock",
    align: "right",
    render: (m) => {
      const stock = m.stock ?? m.available;
      if (stock == null) return "—";
      const short = stock < (m.required ?? m.quantity ?? 0);
      return (
        <span className={short ? "text-status-danger font-semibold" : ""}>
          {stock.toLocaleString()}
        </span>
      );
    },
  },
];

export function MrpPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useMrp(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "MRP not available"}
      </p>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <Link
          to={`/jobs/${id}`}
          className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Job J-{data.jobOrderNo}
        </Link>
        <PageHeader
          title={`MRP sheet — J-${data.jobOrderNo}`}
          subtitle={`${data.customerName}${data.orderNo ? ` · Order #${data.orderNo}` : ""} · ${data.dateLabel}`}
          actions={
            <>
              <a href={jobService.mrpPdfUrl(id!)} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              </a>
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </>
          }
        />
      </div>

      <div className="print-area space-y-4">
        {/* Print header (visible only on paper) */}
        <div className="hidden print:block border-b border-ink-200 pb-3">
          <h1 className="text-xl font-bold">Material Requirement Program — Job J-{data.jobOrderNo}</h1>
          <p className="text-sm">
            {data.customerName}
            {data.orderNo ? ` · Order #${data.orderNo}` : ""} · {data.dateLabel}
          </p>
        </div>

        <Card className="p-5 print:shadow-none print:p-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="info">{data.status}</StatusChip>
            <StatusChip tone={data.productionMode === "outsource" ? "warning" : "neutral"}>
              {data.productionMode === "outsource"
                ? `Outsourced${data.outsourceVendor ? ` — ${data.outsourceVendor}` : ""}`
                : "In-house"}
            </StatusChip>
          </div>
          <h3 className="font-semibold mt-4">Elastics on this job</h3>
          <ul className="mt-2 divide-y divide-ink-100">
            {data.elastics.map((e, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="font-medium">{e.name}</span>
                <span className="tabular-nums">{e.quantity.toLocaleString()} m</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="print:shadow-none">
          <h3 className="font-semibold px-5 pt-5">Material requirement</h3>
          <DataTable
            columns={materialColumns}
            rows={data.materials ?? []}
            rowKey={(m, ) => m.id ?? m.name ?? m.materialName ?? Math.random().toString()}
            emptyTitle="No materials computed"
          />
        </Card>
      </div>
    </>
  );
}
