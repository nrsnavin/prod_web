import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Trash2, Sun, Moon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useShiftPlan, useShiftMutations } from "./hooks";
import { ShiftPlanMachineRow } from "./types";

const columns: Column<ShiftPlanMachineRow>[] = [
  { key: "machine", header: "Machine", render: (m) => <span className="font-medium">{m.machineName}</span> },
  { key: "job", header: "Job", render: (m) => (m.jobOrderNo ? `J-${m.jobOrderNo}` : "—") },
  { key: "operator", header: "Operator", render: (m) => m.operatorName },
  { key: "timer", header: "Runtime", align: "right", render: (m) => m.timer || "—" },
  {
    key: "production",
    header: "Output (m)",
    align: "right",
    render: (m) => m.production.toLocaleString(),
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

export function ShiftPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: plan, isLoading, isError, error } = useShiftPlan(id);
  const { deletePlan } = useShiftMutations();
  const [deleteOpen, setDeleteOpen] = useState(false);

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
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete plan
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-400">Total production</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {plan.totalProduction.toLocaleString()} m
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
          columns={columns}
          rows={plan.machines}
          rowKey={(m) => m.machineId}
          emptyTitle="No machines on this plan"
        />
      </Card>

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
