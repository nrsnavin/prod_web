import { TimerPhotoReader } from "./TimerPhotoReader";
import { ExpectedOutput } from "@/features/productionModel/ExpectedOutput";
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Trash2, Sun, Moon, Download, UploadCloud, Gauge, CheckCircle2, ScanLine, BadgeCheck } from "lucide-react";
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
import { formatDate } from "@/core/format/date";
import { DEFAULT_CM_PER_MIN, perHeadText } from "./productionRate";

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

/** Entered but not verified: the plan shows what was typed, as a draft. */
const isPending = (m: ShiftPlanMachineRow) => m.status === "pending_verification" && !!m.submitted;

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
  {
    key: "timer",
    header: "Runtime",
    align: "right",
    render: (m) => (isPending(m) ? <span className="text-status-warning tabular-nums">{m.submitted!.timer || "—"}</span> : m.timer || "—"),
  },
  {
    key: "production",
    header: "Output (m)",
    align: "right",
    render: (m) =>
      isPending(m) ? (
        <span className="tabular-nums">
          <span className="text-status-warning">{(m.draftProduction ?? 0).toLocaleString("en-IN")}</span>
          <span className="block text-xs text-ink-400">
            {m.submitted!.production != null ? `${m.submitted!.production.toLocaleString("en-IN")} /head × ${m.headsRun ?? 1}` : "—"} · to verify
          </span>
        </span>
      ) : (
        m.production.toLocaleString("en-IN")
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (m) =>
      isPending(m) ? (
        <span>
          <StatusChip tone="warning">Entered — to verify</StatusChip>
          <span className="mt-0.5 block text-xs text-ink-400">
            {m.submitted!.byName ? `by ${m.submitted!.byName}` : "entered"}{m.submitted!.at ? ` at ${when(m.submitted!.at)}` : ""}
          </span>
        </span>
      ) : (
        <StatusChip
          tone={m.status === "closed" ? "success" : m.status === "running" || m.status === "loading" ? "info" : "neutral"}
        >
          {m.status === "closed" ? "Verified" : m.status === "open" ? "Not entered" : m.status}
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
  // An entry awaiting verification opens on what was entered — per head,
  // as the floor typed it — so verifying it is one look and one tap.
  const pending = isPending(row);
  const [meters, setMeters] = useState(
    pending && row.submitted!.production != null ? String(row.submitted!.production) : row.production ? String(row.production) : ""
  );
  const [timer, setTimer] = useState((pending ? row.submitted!.timer : row.timer) ?? "");
  const [note, setNote] = useState("");
  // The metres the run time filled in last: refilled while the field
  // still shows it, left alone once a figure has been typed.
  const [filled, setFilled] = useState<string | null>(null);
  const changeRunTime = (next: string) => {
    setTimer(next);
    const auto = perHeadText(next);
    if (auto && (meters === "" || meters === filled)) {
      setMeters(auto);
      setFilled(auto);
    }
  };

  return (
    <FormScreen open onClose={onClose} title={pending ? "Verify shift production" : "Enter shift production"} width="max-w-md">
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-100/60 p-3 text-sm">
          <p className="font-semibold">{row.machineName}</p>
          <p className="text-ink-600">
            {row.operatorName}
            {row.jobOrderNo ? ` · J-${row.jobOrderNo}` : ""} · {plan.shift === "DAY" ? "Day" : "Night"} ·{" "}
            {formatDate(plan.date)}
          </p>
        </div>
        {pending && (
          <p className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning" role="status">
            Entered{row.submitted!.byName ? ` by ${row.submitted!.byName}` : ""}{row.submitted!.at ? ` at ${when(row.submitted!.at)}` : ""}:{" "}
            <span className="font-semibold tabular-nums">{row.submitted!.production ?? "—"} m/head</span>
            {row.submitted!.timer ? ` · ${row.submitted!.timer}` : ""}
            {row.submitted!.feedback ? ` · “${row.submitted!.feedback}”` : ""}. Change a figure if the counter says otherwise.
          </p>
        )}

        <div className="space-y-2">
          <Input
            label="Production per head (m) *"
            type="number"
            step="0.01"
            autoFocus
            value={meters}
            onChange={(e) => setMeters(e.target.value)}
            hint={meters !== "" && meters === filled ? `Filled from the run time at ${DEFAULT_CM_PER_MIN} cm/min — change it if the counter says otherwise.` : undefined}
          />
          <ExpectedOutput shiftId={row.id} runTime={timer} entered={meters} />
        </div>
        <div className="space-y-2">
          <Input
            label="Runtime (HH:MM:SS)"
            value={timer}
            onChange={(e) => changeRunTime(e.target.value)}
            hint={`Fills the metres a head at ${DEFAULT_CM_PER_MIN} cm a minute.`}
          />
          <TimerPhotoReader onUse={changeRunTime} shiftId={row.id} />
        </div>
        <Input
          label="Note"
          placeholder="Optional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-xs text-ink-400">
          {pending ? "Verifying" : "Saving"} records verified output for this machine and cascades it to the job, order and shift totals.
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
                    toast(pending ? "Verified — cascaded to job & order" : "Production recorded — cascaded to job & order", "success");
                    onClose();
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Failed to record production", "error"),
                }
              )
            }
          >
            {pending ? <BadgeCheck className="h-4 w-4" /> : <Gauge className="h-4 w-4" />} {pending ? "Verify" : "Save production"}
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
  const { deletePlan, confirmPlan, verify } = useShiftMutations();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [verifyAllOpen, setVerifyAllOpen] = useState(false);
  const [verifyingAll, setVerifyingAll] = useState(false);
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
      // The loom was being loaded: nothing to enter, nothing counted.
      if (m.status === "loading") {
        return <span className="text-xs text-ink-400">Loading — no production</span>;
      }
      // Past finishing the job is off the loom and the server refuses the
      // entry, so show why instead of a button that 409s on click.
      if (isProductionLocked(m.jobStatus)) {
        return (
          <span className="text-xs text-ink-400" title={productionLockReason(m.jobStatus)}>
            Production closed
          </span>
        );
      }
      if (isPending(m)) {
        return (
          <Button size="sm" onClick={() => setEntering(m)}>
            <BadgeCheck className="h-4 w-4" /> Verify
          </Button>
        );
      }
      return (
        <Button size="sm" variant="secondary" onClick={() => setEntering(m)}>
          <Gauge className="h-4 w-4" /> Enter production
        </Button>
      );
    },
  };

  // Every entered row, verified with the figures as entered, one after
  // the other; a row that fails stops the run and says which.
  const verifyAll = async () => {
    if (!plan) return;
    const rows = plan.machines.filter(isPending);
    setVerifyingAll(true);
    let done = 0;
    try {
      for (const m of rows) {
        await verify.mutateAsync({ shiftId: m.id, productionMeters: Number(m.submitted!.production ?? 0), timer: m.submitted!.timer ?? undefined });
        done += 1;
      }
      toast(`${done} ${done === 1 ? "entry" : "entries"} verified — cascaded to job & order`, "success");
      setVerifyAllOpen(false);
    } catch (e) {
      toast(`${done} verified; ${rows[done]?.machineName ?? "the next"} failed: ${e instanceof ApiError ? e.message : "try again"}`, "error");
      setVerifyAllOpen(false);
    } finally {
      setVerifyingAll(false);
      refetch();
    }
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
          `${plan.shift === "DAY" ? "Day" : "Night"} shift — ${formatDate(plan.date)}`
        }
        subtitle={plan.description}
        actions={
          <>
            {plan.status === "draft" && (
              <Button
                loading={confirmPlan.isPending}
                onClick={() =>
                  confirmPlan.mutate(plan._id, {
                    onSuccess: () => toast("Shift plan confirmed", "success"),
                    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not confirm the plan", "error"),
                  })
                }
              >
                <CheckCircle2 className="h-4 w-4" /> Confirm plan
              </Button>
            )}
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {plan.status && (
          <StatusChip tone={plan.status === "confirmed" ? "success" : "warning"}>
            {plan.status === "confirmed" ? "Confirmed" : "Draft — not confirmed yet"}
          </StatusChip>
        )}
        {plan.finalized && <StatusChip tone="info">Finalised</StatusChip>}
        {plan.source === "floor" && (
          <StatusChip tone="neutral">
            <ScanLine className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Made from the floor
          </StatusChip>
        )}
      </div>

      {plan.source === "floor" && (
        <Card className="mb-4 p-5" aria-label="From the floor">
          {plan.floor ? (
            <>
              <p className="font-semibold">
                Created on the floor{plan.floor.completedBy ? ` by ${plan.floor.completedBy}` : ""} at{" "}
                {new Date(plan.floor.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                {plan.status === "draft" ? " — ready to confirm." : "."}
              </p>
              <p className="mt-1 text-sm text-ink-600">
                {plan.floor.freeMachines.length
                  ? `Free that shift: ${plan.floor.freeMachines.map((m) => m.ID).join(", ")}.`
                  : "No loom was free that shift."}
              </p>
              {(plan.floor.loadingMachines?.length ?? 0) > 0 && (
                <p className="mt-1 text-sm text-ink-600">
                  Being loaded: {plan.floor.loadingMachines!.map((m) => `${m.ID}${m.operatorName ? ` (${m.operatorName})` : " (nobody put on it)"}`).join(", ")}.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-600">
              A draft being entered on the floor, loom by loom. The supervisor presses Create shift plan when every machine's production is in; the free looms are listed here then.
            </p>
          )}
        </Card>
      )}

      {(plan.pendingCount ?? 0) > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-status-warning/40 bg-status-warningBg p-4" aria-label="To verify">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-status-warning">
              {plan.pendingCount} {plan.pendingCount === 1 ? "entry" : "entries"} entered, waiting to be verified —{" "}
              {(plan.draftedProduction ?? 0).toLocaleString("en-IN")} m drafted.
            </p>
            <p className="text-ink-600">Entered on the floor or by the operator. Nothing reaches the job until you verify it.</p>
          </div>
          <Button onClick={() => setVerifyAllOpen(true)} loading={verifyingAll}>
            <BadgeCheck className="h-4 w-4" /> Verify all as entered
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-400">Verified production</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {plan.totalProduction.toLocaleString("en-IN")} m
          </p>
          {(plan.draftedProduction ?? 0) > 0 && (
            <p className="mt-1 text-xs text-status-warning">+ {(plan.draftedProduction ?? 0).toLocaleString("en-IN")} m drafted, to verify</p>
          )}
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
        open={verifyAllOpen}
        title="Verify every entry as entered?"
        message={`${plan.pendingCount ?? 0} ${(plan.pendingCount ?? 0) === 1 ? "entry is" : "entries are"} verified with the figures as entered (${(plan.draftedProduction ?? 0).toLocaleString("en-IN")} m in all) and cascaded to the jobs and orders. To change a figure first, verify that row on its own.`}
        confirmLabel="Verify all"
        loading={verifyingAll}
        onCancel={() => setVerifyAllOpen(false)}
        onConfirm={() => void verifyAll()}
      />

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
