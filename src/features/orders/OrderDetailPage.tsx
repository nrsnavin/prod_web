import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Play, Flag, Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useOrder, useOrderMutations } from "./hooks";
import { OrderElasticProgress, OrderJobRef, RawMaterialRequirement, StockShortfall } from "./types";
import { OrderAnalytics } from "./OrderAnalytics";
import { orderStatusTone, orderStatusLabel } from "./orderStatus";
import { JobCreateForm } from "@/features/jobs/JobCreateForm";
import { useTrackRecent } from "@/core/ui/uiStore";
import { OrderEtaCard } from "@/features/analytics/breakdown/OrderEtaCard";
import { OrderSuggestedPlan } from "./OrderSuggestedPlan";
import { ForceApprovalDialog } from "./ForceApprovalDialog";

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

// `get-orderDetail` populates `jobs.job` into the full JobOrder document,
// so `j.job` is an object (id lives at `j.job._id`), not a string. Reading
// `j.job` directly produced `/jobs/[object Object]` → "Invalid job ID".
export function jobRefId(j: OrderJobRef): string | undefined {
  if (j.job && typeof j.job === "object") return j.job._id;
  if (typeof j.job === "string") return j.job;
  return j._id;
}
export function jobRefNo(j: OrderJobRef): number | undefined {
  if (j.no != null) return j.no;
  if (j.job && typeof j.job === "object") return j.job.jobOrderNo;
  return j.jobOrderNo;
}
export function jobRefStatus(j: OrderJobRef): string | undefined {
  if (j.job && typeof j.job === "object" && j.job.status) return j.job.status;
  return j.status;
}

function requirementName(r: RawMaterialRequirement): string {
  if (r.name) return r.name;
  if (typeof r.material === "object" && r.material) return r.material.name;
  return "—";
}

// The order-detail endpoint names these `requiredWeight` and `inStock`;
// the other spellings are fallbacks for any legacy caller.
export function requirementRequired(r: RawMaterialRequirement): number {
  return r.requiredWeight ?? r.required ?? r.quantity ?? 0;
}
export function requirementAvailable(r: RawMaterialRequirement): number | null {
  return r.inStock ?? r.available ?? r.stock ?? null;
}

const materialColumns: Column<RawMaterialRequirement>[] = [
  { key: "name", header: "Raw material", render: (r) => requirementName(r) },
  {
    key: "required",
    header: "Required",
    align: "right",
    render: (r) => requirementRequired(r).toLocaleString("en-IN"),
  },
  {
    key: "available",
    header: "In stock",
    align: "right",
    render: (r) => {
      const avail = requirementAvailable(r);
      if (avail == null) return "—";
      const short = avail < requirementRequired(r);
      return <span className={short ? "text-status-danger font-semibold" : ""}>{avail.toLocaleString("en-IN")}</span>;
    },
  },
];

function OrderEditModal({
  order,
  open,
  onClose,
  update,
}: {
  order: { _id: string; po?: string; supplyDate?: string; description?: string; __v?: number };
  open: boolean;
  onClose: () => void;
  update: ReturnType<typeof useOrderMutations>["update"];
}) {
  const { toast } = useToast();
  const [po, setPo] = useState(order.po ?? "");
  const [supplyDate, setSupplyDate] = useState(order.supplyDate ? order.supplyDate.slice(0, 10) : "");
  const [description, setDescription] = useState(order.description ?? "");
  const [auditReason, setAuditReason] = useState("");

  const save = () => {
    if (auditReason.trim().length < 3) { toast("Give a reason (min 3 chars) for the edit", "error"); return; }
    update.mutate(
      {
        id: order._id,
        // expectedVersion = the __v this modal loaded — the server 409s
        // if someone else saved in between (optimistic lock).
        body: { po, supplyDate, description, auditReason: auditReason.trim(), expectedVersion: order.__v },
      },
      {
        onSuccess: () => { toast("Order updated", "success"); onClose(); },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) {
            toast("Someone else edited this order — reloading the latest version", "error");
            onClose(); // the mutation's invalidate refetches; modal reopens fresh
            return;
          }
          toast(e instanceof ApiError ? e.message : "Update failed", "error");
        },
      }
    );
  };

  return (
    <FormScreen open={open} onClose={onClose} title="Edit order" width="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-ink-400">
          Only Open orders can be edited. To change ordered elastics, cancel and recreate the order.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Customer PO ref" value={po} onChange={(e) => setPo(e.target.value)} />
          <Input label="Supply date" type="date" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} />
        </div>
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason for edit *</label>
          <textarea
            rows={2}
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            placeholder="Why is this being changed? (recorded in the audit log)"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={update.isPending} onClick={save}>Save changes</Button>
        </div>
      </div>
    </FormScreen>
  );
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: order, isLoading, isError, error } = useOrder(id);
  const { approve, cancel, startProduction, complete, update, remove } = useOrderMutations();
  const [confirm, setConfirm] = useState<null | "approve" | "cancel" | "start" | "complete">(null);
  // Force-approve state: set from the backend's INSUFFICIENT_STOCK 400 so
  // the admin can override the stock guard with a reason.
  const [forceShortfall, setForceShortfall] = useState<{ shortfall: StockShortfall | null; message: string } | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
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
    mutation: typeof cancel,
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

  // Approve, optionally forcing past a stock shortfall. A plain approve
  // that hits INSUFFICIENT_STOCK opens the force dialog instead of just
  // toasting the error; confirming there re-runs with force + reason.
  const runApprove = (force?: boolean, forceReason?: string) =>
    approve.mutate(
      { id: order._id, force, forceReason },
      {
        onSuccess: () => {
          setConfirm(null);
          setForceShortfall(null);
          toast(force ? "Order force-approved — available stock deducted" : "Order approved — stock deducted", "success");
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === "INSUFFICIENT_STOCK") {
            // Swap the confirm dialog for the force-approve prompt,
            // seeded with the backend's shortfall payload.
            setConfirm(null);
            setForceShortfall({
              shortfall: (e.data?.shortfall as StockShortfall) ?? null,
              message: e.message,
            });
            return;
          }
          setConfirm(null);
          setForceShortfall(null);
          toast(e instanceof ApiError ? e.message : "Action failed", "error");
        },
      }
    );

  const confirmMeta = {
    approve: {
      title: "Approve order?",
      message: "Raw material stock will be deducted for the full order quantity. This is validated against current stock — if a material is short you'll be asked to confirm a force approval.",
      run: () => runApprove(),
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
            {(order.status === "Open" || order.status === "Approved") && (
              <Button variant="secondary" onClick={() => setPlanOpen(true)}>
                <Sparkles className="h-4 w-4" /> Suggested plan
              </Button>
            )}
            {(order.status === "Approved" || order.status === "InProgress") && (
              <Button onClick={() => setJobOpen(true)}>
                <Plus className="h-4 w-4" /> Create job
              </Button>
            )}
            {order.status === "Open" && (
              <>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button onClick={() => setConfirm("approve")}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              </>
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
            {order.status === "Open" && (
              <Button variant="danger" onClick={() => setDelOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </>
        }
      />

      <OrderEditModal
        order={order}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        update={update}
      />
      <ReasonDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title={`Delete order #${order.orderNo}`}
        description="The order is soft-deleted (recoverable) and recorded in the audit trail. Only Open orders with no jobs can be deleted."
        confirmLabel="Delete order"
        loading={remove.isPending}
        onConfirm={(reason) =>
          remove.mutate(
            { id: order._id, auditReason: reason },
            {
              onSuccess: () => { toast("Order deleted", "success"); navigate("/orders"); },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
            }
          )
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

      <OrderEtaCard
        orderId={order._id}
        active={order.status === "Approved" || order.status === "InProgress"}
      />

      {(order.status === "Open" || order.status === "Approved") && (
        <OrderSuggestedPlan order={order} open={planOpen} onClose={() => setPlanOpen(false)} />
      )}

      <OrderAnalytics elastics={order.elastics ?? []} />

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
                const jobId = jobRefId(j);
                const jobNo = jobRefNo(j);
                const jobStatus = jobRefStatus(j);
                return (
                  <li key={jobId ?? i}>
                    <button
                      onClick={() => jobId && navigate(`/jobs/${jobId}`)}
                      disabled={!jobId}
                      className="w-full flex items-center justify-between py-2.5 text-left hover:bg-ink-100/40 rounded-lg px-2 -mx-2 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span className="font-medium text-sm">Job J-{jobNo}</span>
                      {jobStatus && <StatusChip tone="info">{jobStatus}</StatusChip>}
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

      <ForceApprovalDialog
        open={!!forceShortfall}
        shortfall={forceShortfall?.shortfall ?? null}
        originalMessage={forceShortfall?.message}
        loading={approve.isPending}
        onClose={() => setForceShortfall(null)}
        onConfirm={(reason) => runApprove(true, reason)}
      />

      <FormScreen open={jobOpen} onClose={() => setJobOpen(false)} title={`New job for order #${order.orderNo}`}>
        <JobCreateForm
          order={order}
          onClose={() => setJobOpen(false)}
          onCreated={(jobId) => {
            setJobOpen(false);
            navigate(`/jobs/${jobId}`);
          }}
        />
      </FormScreen>
    </>
  );
}
