import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Play, Flag, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useOrder, useOrderMutations } from "./hooks";
import { OrderElasticProgress, RawMaterialRequirement } from "./types";
import { orderStatusTone, orderStatusLabel } from "./orderStatus";
import { JobCreateForm } from "@/features/jobs/JobCreateForm";
import { useTrackRecent } from "@/core/ui/uiStore";

const elasticColumns: Column<OrderElasticProgress>[] = [
  { key: "name", header: "Elastic", render: (e) => <span className="font-medium">{e.name}</span> },
  { key: "ordered", header: "Ordered", align: "right", render: (e) => e.ordered.toLocaleString("en-IN") },
  {
    key: "produced",
    header: "Produced",
    align: "right",
    render: (e) => {
      const pct = e.ordered > 0 ? Math.min(100, (e.produced / e.ordered) * 100) : 0;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-16 rounded-full bg-ink-100 overflow-hidden">
            <span className="block h-full rounded-full bg-status-info" style={{ width: `${pct}%` }} />
          </span>
          <span className="tabular-nums">{e.produced.toLocaleString("en-IN")}</span>
        </span>
      );
    },
  },
  {
    key: "packed",
    header: "Packed",
    align: "right",
    render: (e) => {
      const pct = e.ordered > 0 ? Math.min(100, (e.packed / e.ordered) * 100) : 0;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-16 rounded-full bg-ink-100 overflow-hidden">
            <span className="block h-full rounded-full bg-status-success" style={{ width: `${pct}%` }} />
          </span>
          <span className="tabular-nums">{e.packed.toLocaleString("en-IN")}</span>
        </span>
      );
    },
  },
  {
    key: "pending",
    header: "Pending",
    align: "right",
    render: (e) => (
      <span className={e.pending > 0 ? "font-semibold" : "text-ink-400"}>
        {e.pending.toLocaleString("en-IN")}
      </span>
    ),
  },
];

function requirementName(r: RawMaterialRequirement): string {
  if (r.name) return r.name;
  if (typeof r.material === "object" && r.material) return r.material.name;
  return "—";
}

const materialColumns: Column<RawMaterialRequirement>[] = [
  { key: "name", header: "Raw material", render: (r) => requirementName(r) },
  {
    key: "required",
    header: "Required",
    align: "right",
    render: (r) => (r.required ?? r.quantity ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "available",
    header: "In stock",
    align: "right",
    render: (r) => {
      const avail = r.available ?? r.stock;
      if (avail == null) return "—";
      const short = avail < (r.required ?? r.quantity ?? 0);
      return <span className={short ? "text-status-danger font-semibold" : ""}>{avail.toLocaleString("en-IN")}</span>;
    },
  },
];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: order, isLoading, isError, error } = useOrder(id);
  const { approve, cancel, startProduction, complete } = useOrderMutations();
  const [confirm, setConfirm] = useState<null | "approve" | "cancel" | "start" | "complete">(null);
  const [jobOpen, setJobOpen] = useState(false);
  useTrackRecent("Order", `/orders/${id}`, order ? `Order #${order.orderNo} · ${order.customer?.name ?? ""}` : undefined);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !order) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Order not found"}
      </p>
    );
  }

  const act = (
    mutation: typeof approve,
    successMsg: string
  ) =>
    mutation.mutate(order._id, {
      onSuccess: () => {
        setConfirm(null);
        toast(successMsg, "success");
      },
      onError: (e) => {
        setConfirm(null);
        toast(e instanceof ApiError ? e.message : "Action failed", "error");
      },
    });

  const confirmMeta = {
    approve: {
      title: "Approve order?",
      message: "Raw material stock will be deducted for the full order quantity. This is validated against current stock.",
      run: () => act(approve, "Order approved — stock deducted"),
      loading: approve.isPending,
    },
    cancel: {
      title: "Cancel order?",
      message: `Order #${order.orderNo} will be cancelled.`,
      run: () => act(cancel, "Order cancelled"),
      loading: cancel.isPending,
    },
    start: {
      title: "Start production?",
      message: "The order moves to In Production.",
      run: () => act(startProduction, "Order moved to production"),
      loading: startProduction.isPending,
    },
    complete: {
      title: "Complete order?",
      message: "The order will be marked Completed.",
      run: () => act(complete, "Order completed"),
      loading: complete.isPending,
    },
  } as const;

  return (
    <>
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Orders
      </Link>
      <PageHeader
        title={`Order #${order.orderNo}`}
        subtitle={order.customer?.name}
        actions={
          <>
            {(order.status === "Approved" || order.status === "InProgress") && (
              <Button onClick={() => setJobOpen(true)}>
                <Plus className="h-4 w-4" /> Create job
              </Button>
            )}
            {order.status === "Open" && (
              <Button onClick={() => setConfirm("approve")}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            {order.status === "Approved" && (
              <Button variant="secondary" onClick={() => setConfirm("start")}>
                <Play className="h-4 w-4" /> Start production
              </Button>
            )}
            {order.status === "InProgress" && (
              <Button variant="secondary" onClick={() => setConfirm("complete")}>
                <Flag className="h-4 w-4" /> Complete
              </Button>
            )}
            {(order.status === "Open" || order.status === "Approved") && (
              <Button variant="danger" onClick={() => setConfirm("cancel")}>
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </>
        }
      />

      <Card className="p-6">
        <div className="mb-4">
          <StatusChip tone={orderStatusTone[order.status]}>
            {orderStatusLabel[order.status]}
          </StatusChip>
        </div>
        <DescriptionList
          columns={3}
          items={[
            { label: "Customer", value: order.customer?.name },
            { label: "Customer PO", value: order.po },
            { label: "GSTIN", value: order.customer?.gstin },
            {
              label: "Order date",
              value: order.date ? new Date(order.date).toLocaleDateString() : undefined,
            },
            {
              label: "Supply by",
              value: order.supplyDate ? new Date(order.supplyDate).toLocaleDateString() : undefined,
            },
            { label: "Description", value: order.description },
          ]}
        />
      </Card>

      <Card className="mt-4">
        <h3 className="font-semibold px-5 pt-5">Elastic progress</h3>
        <DataTable
          columns={elasticColumns}
          rows={order.elastics ?? []}
          rowKey={(e) => e.id}
          emptyTitle="No elastics on this order"
        />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold">Jobs</h3>
          {(order.jobs?.length ?? 0) === 0 ? (
            <EmptyState
              title="No jobs yet"
              description="Create a job to send this order to the floor."
            />
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {order.jobs.map((j, i) => {
                const jobId = j.job ?? j._id;
                const jobNo = j.no ?? j.jobOrderNo;
                return (
                  <li key={jobId ?? i}>
                    <button
                      onClick={() => jobId && navigate(`/jobs/${jobId}`)}
                      className="w-full flex items-center justify-between py-2.5 text-left hover:bg-ink-100/40 rounded-lg px-2 -mx-2"
                    >
                      <span className="font-medium text-sm">Job J-{jobNo}</span>
                      {j.status && <StatusChip tone="info">{j.status}</StatusChip>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold px-5 pt-5">Raw material requirement</h3>
          <DataTable
            columns={materialColumns}
            rows={order.rawMaterialRequired ?? []}
            rowKey={(r, ) => requirementName(r)}
            emptyTitle="No requirement computed"
          />
        </Card>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          title={confirmMeta[confirm].title}
          message={confirmMeta[confirm].message}
          confirmLabel="Confirm"
          danger={confirm === "cancel"}
          loading={confirmMeta[confirm].loading}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmMeta[confirm].run}
        />
      )}

      <Modal open={jobOpen} onClose={() => setJobOpen(false)} title={`New job for order #${order.orderNo}`}>
        <JobCreateForm
          order={order}
          onClose={() => setJobOpen(false)}
          onCreated={(jobId) => {
            setJobOpen(false);
            navigate(`/jobs/${jobId}`);
          }}
        />
      </Modal>
    </>
  );
}
