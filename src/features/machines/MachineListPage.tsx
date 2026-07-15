import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Wrench, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useMachines, useMachineMutations, useMaintenanceDue } from "./hooks";
import { MachineHealthBanner } from "./MachineHealth";
import { Machine, MachineFormValues, MachineStatus } from "./types";

const statusTone: Record<MachineStatus, ChipTone> = {
  running: "success",
  free: "info",
  maintenance: "warning",
};

function jobNo(m: Machine): string {
  if (m.orderRunning && typeof m.orderRunning === "object") {
    return m.orderRunning.jobOrderNo?.toString() ?? "—";
  }
  return "—";
}

const columns: Column<Machine>[] = [
  { key: "id", header: "Machine", render: (m) => <span className="font-medium">{m.ID}</span> },
  { key: "make", header: "Manufacturer", render: (m) => m.manufacturer },
  { key: "heads", header: "Heads", align: "right", render: (m) => m.NoOfHead },
  { key: "hooks", header: "Hooks", align: "right", render: (m) => m.NoOfHooks },
  { key: "job", header: "Running job", render: (m) => jobNo(m) },
  {
    key: "status",
    header: "Status",
    render: (m) => <StatusChip tone={statusTone[m.status]}>{m.status}</StatusChip>,
  },
];

const machineSchema = z.object({
  ID: z.string().min(1, "Machine ID is required"),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  NoOfHead: z.coerce.number().min(1, "At least 1"),
  NoOfHooks: z.coerce.number().min(1, "At least 1"),
  DateOfPurchase: z.string().optional(),
});

function MachineForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: MachineFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MachineFormValues>({
    resolver: zodResolver(machineSchema),
    defaultValues: { ID: "", manufacturer: "", NoOfHead: 1, NoOfHooks: 1 },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Machine ID *" placeholder="e.g. LOOM-12" error={errors.ID?.message} {...register("ID")} />
        <Input label="Manufacturer *" error={errors.manufacturer?.message} {...register("manufacturer")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Heads *" type="number" error={errors.NoOfHead?.message} {...register("NoOfHead")} />
        <Input label="Hooks *" type="number" error={errors.NoOfHooks?.message} {...register("NoOfHooks")} />
        <Input label="Purchased on" type="date" {...register("DateOfPurchase")} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Add machine</Button>
      </div>
    </form>
  );
}

export function MachineListPage() {
  const [status, setStatus] = useState<MachineStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useMachines(status);
  const due = useMaintenanceDue(14);
  const { create } = useMachineMutations();

  return (
    <>
      <PageHeader
        title="Machines"
        subtitle={data ? `${data.length} machines` : undefined}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add machine
          </Button>
        }
      />

      <MachineHealthBanner />

      {(due.data?.count ?? 0) > 0 && (
        <Card className="mb-4 p-4 border-l-4 border-status-warning">
          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 text-status-warning shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {due.data!.count} machine{due.data!.count > 1 ? "s" : ""} due for service
                {due.data!.overdueCount > 0 && (
                  <span className="text-status-danger"> · {due.data!.overdueCount} overdue</span>
                )}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {due.data!.data.map((d) => (
                  <li key={d.machineId}>
                    <button
                      onClick={() => navigate(`/machines/${d.machineId}`)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium hover:border-ink-400"
                    >
                      {d.overdue && <AlertTriangle className="h-3 w-3 text-status-danger" />}
                      {d.ID}
                      <span className={d.overdue ? "text-status-danger" : "text-ink-400"}>
                        {d.overdue
                          ? `${Math.abs(d.daysUntil)}d overdue`
                          : `in ${d.daysUntil}d`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-4">
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "running", label: "Running" },
            { value: "free", label: "Free" },
            { value: "maintenance", label: "Maintenance" },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(m) => m._id}
          onRowClick={(m) => navigate(`/machines/${m._id}`)}
          loading={isLoading}
          emptyTitle="No machines found"
        />
      </Card>

      <FormScreen open={createOpen} onClose={() => setCreateOpen(false)} title="Add machine">
        <MachineForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                toast("Machine added", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to add machine", "error"),
            })
          }
        />
      </FormScreen>
    </>
  );
}
