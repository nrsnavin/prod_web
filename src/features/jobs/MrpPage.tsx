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
import { ProductionModeControl } from "./ProductionModeControl";
import { MrpShortfallPo } from "./MrpShortfallPo";

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
    header: "Required (kg)",
    align: "right",
    render: (m) => (m.requiredWeight ?? m.required ?? m.quantity ?? 0).toLocaleString("en-IN"),
  },
  {
    // Approving the parent order took this job's share of the material
    // out of stock. Without saying so, the sheet showed a requirement
    // it had already met and a stock figure it had already reduced —
    // and every job read as short of yarn standing on the floor for it.
    key: "allocated",
    header: "Allocated",
    align: "right",
    render: (m) => {
      const drawn = m.allocated ?? 0;
      if (drawn <= 0) return <span className="text-ink-400">—</span>;
      return (
        <span
          className="text-status-success"
          title="Held for this job since its order was approved — out of the stock figure beside it, not available to anything else"
        >
          {drawn.toLocaleString("en-IN")}
        </span>
      );
    },
  },
  {
    key: "stock",
    header: "In stock",
    align: "right",
    render: (m) => {
      const stock = m.inStock ?? m.stock ?? m.available;
      // A current backend always sends a numeric inStock (0 when the
      // material has none). A missing value means the API didn't return
      // the field at all — say so rather than showing a bare dash.
      // stockKnown:false means the RawMaterial could not be resolved
      // (deleted), so the 0 below is a placeholder, not a real reading.
      if (stock == null || m.stockKnown === false) {
        return (
          <span className="text-status-warning" title="This material could not be found — stock is unknown">
            unknown
          </span>
        );
      }
      const req = m.requiredWeight ?? m.required ?? m.quantity ?? 0;
      // Against what is still to be drawn, not the gross requirement:
      // the drawn part is no longer in the figure being compared.
      const short = stock < (m.outstanding ?? req - (m.allocated ?? 0));
      return (
        <span className={short ? "text-status-danger font-semibold" : ""}>
          {stock.toLocaleString("en-IN")}
        </span>
      );
    },
  },
  {
    // Deliberately its own column rather than folded into stock. Yarn
    // that has been bought is not yarn that has arrived, and a shortfall
    // that looks covered is how the same purchase order gets raised
    // twice.
    key: "onOrder",
    header: "On order",
    align: "right",
    render: (m) => {
      const due = m.onOrder ?? 0;
      if (due <= 0) return <span className="text-ink-400">—</span>;
      return (
        <span className="text-status-info" title="Outstanding on open purchase orders — not yet received">
          {due.toLocaleString("en-IN")}
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
      <div>
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
              {/* Print the SAME sheet that downloads — the server-rendered
                  PDF. Printing the on-page HTML produced a second,
                  different-looking MRP sheet for the same job, which is the
                  divergence the delivery challan already had. */}
              <a href={jobService.mrpPdfUrl(id!)} target="_blank" rel="noreferrer">
                <Button>
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </a>
            </>
          }
        />
      </div>

      {/* Screen view only. The printed/downloaded sheet is the server PDF
          (utils/mrpPdf.js), so this no longer carries a print-only header
          pretending to be it. */}
      <div className="space-y-4">

        {/* Above the material table on purpose: a shortfall is the thing
            that needs doing, not a footnote to the numbers. */}
        <MrpShortfallPo jobId={id!} materials={data.materials} />

        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="info">{data.status}</StatusChip>
            {/* Read-only badge on paper; the interactive control below is
                hidden on print. */}
            <StatusChip tone={data.productionMode === "outsource" ? "warning" : "neutral"}>
              {data.productionMode === "outsource"
                ? `Outsourced${data.outsourceVendor ? ` — ${data.outsourceVendor}` : ""}`
                : "In-house"}
            </StatusChip>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium text-ink-600 mb-1.5">Production</h3>
            <ProductionModeControl
              jobId={id!}
              mode={data.productionMode}
              vendor={data.outsourceVendor}
              jobStatus={data.status}
            />
          </div>

          <h3 className="font-semibold mt-4">Elastics on this job</h3>
          <ul className="mt-2 divide-y divide-ink-100">
            {data.elastics.map((e, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="font-medium">{e.name}</span>
                <span className="tabular-nums">{e.quantity.toLocaleString("en-IN")} m</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
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
