import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Trash2, Sun, Moon, Download, UploadCloud, Gauge } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useShiftPlan, useShiftMutations } from "./hooks";
import { ShiftPlanDetail, ShiftPlanMachineRow } from "./types";
import { OutsourcedMark } from "./OutsourcedTag";
import { isProductionLocked, productionLockReason } from "@/features/jobs/productionLock";
import { sheetService } from "./sheet";
import { SheetUploadModal } from "./SheetUploadModal";

const columns: Column<ShiftPlanMachineRow>[] = [
  { key: "machine", header: "Machine", render: (m) => <span className="font-medium">{m.machineName}</span> },
  {
    key: "job",
    header: "Job",
    render: (m) =>
      m.jobOrderNo ? (
        <span className="inline-flex items-center whitespace-nowrap">
          J-{m.jobOrderNo}
          <OutsourcedMark productionMode={m.productionMode} outsourceVendor={m.outsourceVendor} />
        </span>
      ) : (
        "—"
      ),
  },
  { key: "operator", header: "Operator", render: (m) => m.operatorName },
  { key: "timer", header: "Runtime", align: "right", render: (m) => m.timer || "—" },
  {
    key: "production",
    header: "Output (m)",
    align: "right",
    render: (m) => m.production.toLocaleString("en-IN"),
  },
  {
    key: "status",
    header: "Status",
    render: (m) => (
      <StatusChip
        tone={m.status === "closed" ? "success" : m.status === "running" ? "info" : "neutral"}
      >
        {m.status}
      </StatusChip>
    ),
  },
];

// Admin enters (or overrides) output for a machine row that hasn't been
// closed yet, going straight to verified — the same verify-production path
// the worker-submission flow lands in, so job/order/plan totals cascade.
export function EnterProductionModal({
  plan,
  row,
  onClose,
}: {
  plan: ShiftPlanDetail;
  row: ShiftPlanMachineRow;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { verify } = useShiftMutations();
  const [meters, setMeters] = useState(row.production ? String(row.production) : "");
  const [timer, setTimer] = useState(row.timer ?? "");
  const [note, setNote] = useState("");

  return (
    <FormScreen open onClose={onClose} title="Enter shift production" width="max-w-md">
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-100/60 p-3 text-sm">
          <p className="font-semibold">{row.machineName}</p>
          <p className="text-ink-600">
            {row.operatorName}
            {row.jobOrderNo ? ` · J-${row.jobOrderNo}` : ""} · {plan.shift === "DAY" ? "Day" : "Night"} ·{" "}
            {new Date(plan.date).toLocaleDateString()}
          </p>
        </div>

        <Input
          label="Production (m) *"
          type="number"
          step="0.01"
          autoFocus
          value={meters}
          onChange={(e) => setMeters(e.target.value)}
        />
        <Input label="Runtime (HH:MM:SS)" value={timer} onChange={(e) => setTimer(e.target.value)} />
        <Input
          label="Note"
          placeholder="Optional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-xs text-ink-400">
          Saving records verified output for this machine and cascades it to the job, order and shift totals.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!meters}
            loading={verify.isPending}
            onClick={() =>
              verify.mutate(
                {
                  shiftId: row.id,
                  productionMeters: Number(meters),
                  timer: timer || undefined,
                  note: note || undefined,
                },
                {
                  onSuccess: () => {
                    toast("Production recorded — cascaded to job & order", "success");
                    onClose();
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Failed to record production", "error"),
                }
              )
            }
          >
            <Gauge className="h-4 w-4" /> Save production
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}

export function ShiftPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: plan, isLoading, isError, error, refetch } = useShiftPlan(id);
  const { deletePlan } = useShiftMutations();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [entering, setEntering] = useState<ShiftPlanMachineRow | null>(null);

  // Open (not-yet-closed) rows get an "Enter production" action so an
  // admin can record output directly, without waiting on a worker submit.
  const actionColumn: Column<ShiftPlanMachineRow> = {
    key: "actions",
    header: "",
    align: "right",
    render: (m) => {
      if (m.status === "closed") return null;
      // Past finishing the job is off the loom and the server refuses the
      // entry, so show why instead of a button that 409s on click.
      if (isProductionLocked(m.jobStatus)) {
        return (
          <span className="text-xs text-ink-400" title={productionLockReason(m.jobStatus)}>
            Production closed
          </span>
        );
      }
      return (
        <Button size="sm" variant="secondary" onClick={() => setEntering(m)}>
          <Gauge className="h-4 w-4" /> Enter production
        </Button>
      );
    },
  };

  const downloadSheet = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const label = `production-sheet-${plan ? new Date(plan.date).toISOString().slice(0, 10) : id}-${plan?.shift ?? ""}.pdf`;
      await sheetService.download(id, label);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Download failed", "error");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !plan) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Shift plan not found"}
      </p>
    );
  }

  return (
    <>
      <Link to="/shift-plans" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Shift plans
      </Link>
      <PageHeader
        title={
          `${plan.shift === "DAY" ? "Day" : "Night"} shift — ${new Date(plan.date).toLocaleDateString()}`
        }
        subtitle={plan.description}
        actions={
          <>
            <Button variant="secondary" onClick={downloadSheet} loading={downloading}>
              <Download className="h-4 w-4" /> Download sheet
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloud className="h-4 w-4" /> Upload filled sheet
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete plan
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-400">Total production</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {plan.totalProduction.toLocaleString("en-IN")} m
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-400">Machines</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{plan.machines.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-400">Operators</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{plan.operatorCount}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="font-semibold px-5 pt-5 flex items-center gap-2">
          {plan.shift === "DAY" ? (
            <Sun className="h-4 w-4 text-status-warning" />
          ) : (
            <Moon className="h-4 w-4 text-ink-400" />
          )}
          Machine assignments
        </h3>
        <DataTable
          columns={[...columns, actionColumn]}
          rows={plan.machines}
          rowKey={(m) => m.machineId}
          emptyTitle="No machines on this plan"
        />
      </Card>

      {entering && (
        <EnterProductionModal plan={plan} row={entering} onClose={() => setEntering(null)} />
      )}

      {id && (
        <SheetUploadModal
          planId={id}
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onApplied={() => refetch()}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete shift plan?"
        message="The plan and all its shift entries are removed. This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deletePlan.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() =>
          deletePlan.mutate(plan._id, {
            onSuccess: () => {
              toast("Shift plan deleted", "success");
              navigate("/shift-plans");
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
          })
        }
      />
    </>
  );
}
