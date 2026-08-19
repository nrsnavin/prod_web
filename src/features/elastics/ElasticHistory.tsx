import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { orderStatusTone, orderStatusLabel } from "../orders/orderStatus";
import { jobStatusTone } from "../jobs/jobStatus";
import type { OrderStatus } from "../orders/types";
import type { JobStatus } from "../jobs/types";
import { useElasticOrders, useElasticJobs } from "./hooks";
import type { ElasticJobRow, ElasticOrderRow } from "./types";

/**
 * Where this elastic has been: the orders that asked for it and the jobs
 * that made it.
 *
 * The stock card above says how much of a product there is. Neither of
 * these does — they answer the questions that come up when a customer
 * rings about the product rather than the number. Who else buys this.
 * What did we quote them. When did we last run it, and how much came off
 * the machine that time.
 *
 * Both lists page. A product that has been in the catalogue for a few
 * years has hundreds of each, and loading all of them to show ten is
 * work nobody asked for. Paged rather than infinite-scrolled because the
 * two sit side by side and a page can be stepped back through.
 *
 * Every quantity is THIS elastic's line off a shared document. An order
 * carrying four products would otherwise report the other three as this
 * one's — a failure that produces entirely believable numbers.
 */
const PAGE_SIZE = 10;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtQty = (n: number) => (n > 0 ? n.toLocaleString("en-IN") : "—");

/**
 * Status → tone and label, delegated to the maps the rest of the app
 * already uses. Writing a second set here would drift from them, and
 * the first symptom is what this panel first shipped with: the raw
 * enum "INPROGRESS" on screen where every other page says "In
 * production".
 *
 * Both fall back, because these lists can show a state the maps do not
 * cover — a Deleted order is hidden by default but askable for.
 */
const orderTone = (status: string): ChipTone =>
  orderStatusTone[status as OrderStatus] ?? (status === "Deleted" ? "danger" : "neutral");

const orderLabel = (status: string) => orderStatusLabel[status as OrderStatus] ?? status;

const jobTone = (status: string): ChipTone =>
  jobStatusTone[status as JobStatus] ?? "neutral";

export function ElasticHistory({ elasticId }: { elasticId: string }) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <ElasticOrders elasticId={elasticId} />
      <ElasticJobs elasticId={elasticId} />
    </div>
  );
}

function ElasticOrders({ elasticId }: { elasticId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useElasticOrders(elasticId, page, PAGE_SIZE);

  const columns: Column<ElasticOrderRow>[] = [
    {
      key: "order",
      header: "Order",
      render: (o) => (
        <div>
          <span className="font-medium">#{o.orderNo ?? "—"}</span>
          {o.po && <span className="ml-2 text-xs text-ink-400">PO {o.po}</span>}
          <p className="text-xs text-ink-400">{fmtDate(o.date)}</p>
        </div>
      ),
      sort: (o) => o.orderNo ?? 0,
    },
    {
      key: "customer",
      header: "Customer",
      cellClassName: "whitespace-normal",
      render: (o) => o.customerName || "—",
      sort: (o) => o.customerName,
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusChip tone={orderTone(o.status)}>{orderLabel(o.status)}</StatusChip>,
    },
    {
      key: "ordered",
      header: "Ordered (m)",
      align: "right",
      render: (o) => <span className="tabular-nums">{fmtQty(o.ordered)}</span>,
      sort: (o) => o.ordered,
    },
    {
      key: "packed",
      header: "Packed (m)",
      align: "right",
      render: (o) => <span className="tabular-nums">{fmtQty(o.packed)}</span>,
      sort: (o) => o.packed,
    },
  ];

  const total = data?.total ?? 0;

  return (
    <Card role="region" aria-label="Orders for this elastic">
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="font-semibold">Orders for this elastic</h3>
          {total > 0 && <span className="text-xs text-ink-400">{total.toLocaleString("en-IN")} in all</span>}
        </div>
        <p className="text-xs text-ink-400">
          Every order carrying this product, newest first. Quantities are this
          product's line, not the order's total.
        </p>
      </div>
      <div className="mt-2">
        <DataTable
          columns={columns}
          rows={data?.orders ?? []}
          rowKey={(o) => o.id}
          loading={isLoading}
          error={isError ? error : undefined}
          errorWhat="orders for this product"
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          emptyTitle="Never ordered"
          emptyDescription="No order has asked for this elastic yet."
        />
      </div>
      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />
    </Card>
  );
}

function ElasticJobs({ elasticId }: { elasticId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useElasticJobs(elasticId, page, PAGE_SIZE);

  const columns: Column<ElasticJobRow>[] = [
    {
      key: "job",
      header: "Job",
      render: (j) => (
        <div>
          <span className="font-medium">{j.jobNo || "—"}</span>
          {j.orderNo != null && <span className="ml-2 text-xs text-ink-400">order #{j.orderNo}</span>}
          <p className="text-xs text-ink-400">{fmtDate(j.date)}</p>
        </div>
      ),
      sort: (j) => j.jobOrderNo ?? 0,
    },
    {
      key: "status",
      header: "Status",
      render: (j) => <StatusChip tone={jobTone(j.status)}>{j.status}</StatusChip>,
    },
    {
      key: "planned",
      header: "Planned (m)",
      align: "right",
      render: (j) => <span className="tabular-nums">{fmtQty(j.planned)}</span>,
      sort: (j) => j.planned,
    },
    {
      key: "produced",
      header: "Produced (m)",
      align: "right",
      render: (j) => <span className="tabular-nums">{fmtQty(j.produced)}</span>,
      sort: (j) => j.produced,
    },
    {
      key: "wastage",
      header: "Wastage (m)",
      align: "right",
      render: (j) => (
        <span className={j.wastage > 0 ? "tabular-nums text-status-warning" : "tabular-nums"}>
          {fmtQty(j.wastage)}
        </span>
      ),
      sort: (j) => j.wastage,
    },
  ];

  const total = data?.total ?? 0;

  return (
    <Card role="region" aria-label="Jobs that produced it">
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="font-semibold">Jobs that produced it</h3>
          {total > 0 && <span className="text-xs text-ink-400">{total.toLocaleString("en-IN")} in all</span>}
        </div>
        <p className="text-xs text-ink-400">
          {/* A cancelled job made nothing; it is part of the record but not
              of the output, so it is left out unless someone asks. */}
          Newest first. Cancelled jobs are excluded — they produced nothing.
        </p>
      </div>
      <div className="mt-2">
        <DataTable
          columns={columns}
          rows={data?.jobs ?? []}
          rowKey={(j) => j.id}
          loading={isLoading}
          onRowClick={(j) => navigate(`/jobs/${j.id}`)}
          emptyTitle="Never produced"
          emptyDescription="No job has been raised for this elastic yet."
        />
      </div>
      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />
    </Card>
  );
}
