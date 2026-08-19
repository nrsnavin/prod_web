import { useState } from "react";
import { Sun, Moon, X, Pencil, Trash2, Lock, LockOpen } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { DataTable, Column } from "@/components/ui/DataTable";
import { cn } from "@/components/ui/cn";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { shiftService, productionService } from "./api";
import { useProductionRange, useProductionShiftDetail } from "./hooks";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProductionShiftSlice } from "./types";
import { presetRange, toISODate } from "@/features/analytics/components/FilterBar";
import { OutsourcedMark } from "./OutsourcedTag";

const sliceTone: Record<string, ChipTone> = {
  closed: "success",
  running: "info",
  open: "warning",
  none: "neutral",
};

function ShiftSlice({
  slice,
  label,
  icon,
  onOpen,
}: {
  slice: ProductionShiftSlice;
  label: string;
  icon: React.ReactNode;
  onOpen: (id: string) => void;
}) {
  if (!slice.exists) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-ink-100/50 px-3 py-2 text-sm text-ink-400">
        {icon} {label}: no plan
      </div>
    );
  }
  return (
    <button
      onClick={() => slice.shiftPlanId && onOpen(slice.shiftPlanId)}
      className="flex items-center gap-2 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm hover:border-brand-500 transition-colors w-full"
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="tabular-nums">{(slice.production ?? 0).toLocaleString("en-IN")} m</span>
      <span className="text-xs text-ink-400">
        {slice.machineCount ?? 0} mc · {slice.operatorCount ?? 0} op
      </span>
      <span className="ml-auto">
        <StatusChip tone={sliceTone[slice.statusSummary ?? "none"]}>
          {slice.statusSummary}
        </StatusChip>
      </span>
    </button>
  );
}

type DetailRow = {
  shiftDetailId: string;
  status: string;
  timerLabel: string;
  productionMeters: number;
  machine?: { machineID?: string } | null;
  employee?: { name?: string; department?: string } | null;
  job?: {
    jobNo?: number; status?: string;
    productionMode?: string; outsourceVendor?: string;
  } | null;
};

function useProductionEntryMutations(shiftPlanId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["production"] });
    qc.invalidateQueries({ queryKey: ["shift-detail", shiftPlanId] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const correct = useMutation({
    mutationFn: ({ shiftId, productionMeters, auditReason }: { shiftId: string; productionMeters: number; auditReason: string }) =>
      shiftService.correctProduction(shiftId, { productionMeters, auditReason }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ shiftId, auditReason }: { shiftId: string; auditReason: string }) =>
      shiftService.deleteProduction(shiftId, auditReason),
    onSuccess: invalidate,
  });
  return { correct, remove };
}

function ProductionEditModal({
  row,
  correct,
  onClose,
}: {
  row: DetailRow;
  correct: ReturnType<typeof useProductionEntryMutations>["correct"];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [meters, setMeters] = useState(String(row.productionMeters));
  const [auditReason, setAuditReason] = useState("");
  const save = () => {
    if (auditReason.trim().length < 3) { toast("Give a reason (min 3 chars)", "error"); return; }
    if (!(Number(meters) >= 0)) { toast("Output must be ≥ 0", "error"); return; }
    correct.mutate(
      { shiftId: row.shiftDetailId, productionMeters: Number(meters), auditReason: auditReason.trim() },
      {
        onSuccess: () => { toast("Production corrected", "success"); onClose(); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Correction failed", "error"),
      }
    );
  };
  return (
    <FormScreen open onClose={onClose} title="Correct production entry" width="max-w-md">
      <div className="space-y-4">
        <Input label="Total output (m)" type="number" step="0.01" value={meters} onChange={(e) => setMeters(e.target.value)} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason for correction *</label>
          <textarea
            aria-label="Reason for this change"
            rows={2}
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            placeholder="Why is this being corrected? (recorded in the audit log)"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <p className="text-xs text-ink-400">Re-derives the job / order / plan totals by the difference. The rate model self-corrects on future shifts.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={correct.isPending} onClick={save}>Save correction</Button>
        </div>
      </div>
    </FormScreen>
  );
}

function ShiftDetailModal({ shiftPlanId, onClose }: { shiftPlanId: string; onClose: () => void }) {
  const { data, isLoading } = useProductionShiftDetail(shiftPlanId);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { correct, remove } = useProductionEntryMutations(shiftPlanId);
  const [editRow, setEditRow] = useState<DetailRow | null>(null);
  const [delRow, setDelRow] = useState<DetailRow | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  const finalized = data?.finalized ?? false;
  const allVerified =
    (data?.details.length ?? 0) > 0 && (data?.details ?? []).every((d) => d.status === "closed");

  const invalidateDetail = () => {
    qc.invalidateQueries({ queryKey: ["production"] });
    qc.invalidateQueries({ queryKey: ["production", "shift-detail", shiftPlanId] });
  };
  const finalize = useMutation({
    mutationFn: () => productionService.finalizePlan(shiftPlanId),
    onSuccess: (r) => {
      invalidateDetail();
      setFinalizeOpen(false);
      toast(r.message ?? "Shift finalised", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Finalise failed", "error"),
  });
  const reopen = useMutation({
    mutationFn: () => productionService.unfinalizePlan(shiftPlanId),
    onSuccess: () => {
      invalidateDetail();
      setReopenOpen(false);
      toast("Shift reopened for corrections", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Reopen failed", "error"),
  });

  const detailColumns: Column<DetailRow>[] = [
    { key: "machine", header: "Machine", render: (d) => d.machine?.machineID ?? "—" },
    { key: "operator", header: "Operator", render: (d) => d.employee?.name ?? "—" },
    {
      key: "job",
      header: "Job",
      render: (d) =>
        d.job?.jobNo ? (
          <span className="inline-flex items-center whitespace-nowrap">
            J-{d.job.jobNo}
            <OutsourcedMark
              productionMode={d.job.productionMode}
              outsourceVendor={d.job.outsourceVendor}
            />
          </span>
        ) : (
          "—"
        ),
    },
    { key: "timer", header: "Runtime", align: "right", render: (d) => d.timerLabel },
    { key: "prod", header: "Output (m)", align: "right", render: (d) => d.productionMeters.toLocaleString("en-IN") },
    { key: "status", header: "Status", render: (d) => <StatusChip tone={sliceTone[d.status] ?? "neutral"}>{d.status}</StatusChip> },
    {
      key: "act",
      header: "",
      align: "right",
      render: (d) =>
        d.status === "closed" && !finalized ? (
          <span className="inline-flex gap-1">
            <button onClick={() => setEditRow(d)} className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Correct production">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setDelRow(d)} className="p-1.5 rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger" aria-label="Delete production">
              <Trash2 className="h-4 w-4" />
            </button>
          </span>
        ) : null,
    },
  ];

  return (
    <Modal open onClose={onClose} title={data ? `${data.shift} shift · ${data.dateLabel}` : "Shift detail"} width="max-w-3xl">
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4 text-center">
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.totalProduction.toLocaleString("en-IN")}</p>
              <p className="text-xs text-ink-400">meters</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.totalMachines}</p>
              <p className="text-xs text-ink-400">machines</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.totalOperators}</p>
              <p className="text-xs text-ink-400">operators</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{data.summary.timerLabel}</p>
              <p className="text-xs text-ink-400">total runtime</p>
            </div>
          </div>
          {/* Finalisation — locks the day's verified numbers. */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
            {finalized ? (
              <>
                <span className="flex items-center gap-1.5 text-sm text-ink-600">
                  <Lock className="h-4 w-4 text-status-success" />
                  <StatusChip tone="success">Finalised</StatusChip>
                  {data.finalizedBy && <span className="text-xs text-ink-400">by {data.finalizedBy}</span>}
                  <span className="text-xs text-ink-400">— entries are locked</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => setReopenOpen(true)}>
                  <LockOpen className="h-4 w-4" /> Reopen
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-ink-600">
                  {allVerified
                    ? "All entries verified — finalise to lock this shift's numbers."
                    : "Finalise becomes available once every entry is verified."}
                </span>
                <Button size="sm" disabled={!allVerified} onClick={() => setFinalizeOpen(true)}>
                  <Lock className="h-4 w-4" /> Finalise shift
                </Button>
              </>
            )}
          </div>

          <DataTable
            columns={detailColumns}
            rows={data.details}
            rowKey={(d) => d.shiftDetailId}
            emptyTitle="No entries"
          />

          <ConfirmDialog
            open={finalizeOpen}
            title={`Finalise ${data.shift} shift · ${data.dateLabel}?`}
            message="Locks every production entry — no corrections, deletions or new entries after this. The numbers become final for payroll and reports. An admin can reopen if truly needed."
            confirmLabel="Finalise"
            loading={finalize.isPending}
            onCancel={() => setFinalizeOpen(false)}
            onConfirm={() => finalize.mutate()}
          />
          <ConfirmDialog
            open={reopenOpen}
            title="Reopen this shift?"
            message="Unlocks the entries so corrections are possible again. Refinalise when done."
            confirmLabel="Reopen"
            danger
            loading={reopen.isPending}
            onCancel={() => setReopenOpen(false)}
            onConfirm={() => reopen.mutate()}
          />
          {editRow && <ProductionEditModal row={editRow} correct={correct} onClose={() => setEditRow(null)} />}
          <ReasonDialog
            open={!!delRow}
            onClose={() => setDelRow(null)}
            title="Delete production entry"
            description="Reverses this shift's output from the job / order / plan totals and un-verifies it for re-entry. Recorded in the audit trail."
            confirmLabel="Delete entry"
            loading={remove.isPending}
            onConfirm={(reason) =>
              delRow &&
              remove.mutate(
                { shiftId: delRow.shiftDetailId, auditReason: reason },
                {
                  onSuccess: () => { toast("Production entry deleted", "success"); setDelRow(null); },
                  onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
                }
              )
            }
          />
        </>
      )}
    </Modal>
  );
}

export function ProductionViewPage() {
  const [range, setRange] = useState(presetRange(6));
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, error } = useProductionRange(range.startDate, range.endDate);

  return (
    <>
      <PageHeader
        title="Production view"
        subtitle="Day-by-day output split across day and night shifts."
      />

      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        {[
          { label: "7D", days: 6 },
          { label: "14D", days: 13 },
          { label: "30D", days: 29 },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => setRange(presetRange(p.days))}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium",
              presetRange(p.days).startDate === range.startDate
                ? "bg-ink-900 text-canvas"
                : "bg-ink-100 text-ink-600 hover:text-ink-900"
            )}
          >
            {p.label}
          </button>
        ))}
        {/* Subtle signal that a preset/date change is refetching while the
            previous rows stay visible (placeholderData). */}
        {isFetching && !isLoading && (
          <span className="ml-1 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-500" aria-label="Refreshing" />
        )}
        <div className="flex items-center gap-2 text-sm ml-2">
          <input aria-label="Start date"
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
            className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
          />
          <span className="text-ink-400">→</span>
          <input aria-label="End date"
            type="date"
            value={range.endDate}
            min={range.startDate}
            max={toISODate(new Date())}
            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
            className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
      </Card>

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {[...(data ?? [])].reverse().map((day) => (
            <Card key={day.date} className={cn("p-4", !day.hasData && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-28">
                  <p className="font-semibold">{day.dateLabel}</p>
                  <p className="text-xs text-ink-400">{day.dayOfWeek}</p>
                </div>
                <div className="grid flex-1 gap-2 sm:grid-cols-2 min-w-64">
                  <ShiftSlice
                    slice={day.dayShift}
                    label="Day"
                    icon={<Sun className="h-4 w-4 text-status-warning" />}
                    onOpen={setOpenPlan}
                  />
                  <ShiftSlice
                    slice={day.nightShift}
                    label="Night"
                    icon={<Moon className="h-4 w-4 text-ink-400" />}
                    onOpen={setOpenPlan}
                  />
                </div>
                <div className="text-right w-28">
                  <p className="text-lg font-bold tabular-nums">
                    {day.totalProduction.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-ink-400">meters</p>
                </div>
              </div>
            </Card>
          ))}
          {(data?.length ?? 0) === 0 && (
            <Card className="p-8 text-center text-sm text-ink-400">
              <X className="h-6 w-6 mx-auto mb-2" /> No data in this range.
            </Card>
          )}
        </div>
      )}

      {openPlan && <ShiftDetailModal shiftPlanId={openPlan} onClose={() => setOpenPlan(null)} />}
    </>
  );
}
