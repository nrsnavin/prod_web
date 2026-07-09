import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Wrench, Play } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMachine, useMachineMutations } from "./hooks";
import { MachineShiftRow, MachineStatus, ServiceLogFormValues } from "./types";
import { useTrackRecent } from "@/core/ui/uiStore";

const statusTone: Record<MachineStatus, ChipTone> = {
  running: "success",
  free: "info",
  maintenance: "warning",
};

const shiftColumns: Column<MachineShiftRow>[] = [
  { key: "date", header: "Date", render: (s) => new Date(s.date).toLocaleDateString() },
  {
    key: "shift",
    header: "Shift",
    render: (s) => <StatusChip tone={s.shift === "DAY" ? "info" : "neutral"}>{s.shift}</StatusChip>,
  },
  { key: "emp", header: "Operator", render: (s) => s.employee },
  { key: "runtime", header: "Runtime (min)", align: "right", render: (s) => s.runtimeMinutes },
  { key: "output", header: "Output (m)", align: "right", render: (s) => s.outputMeters.toLocaleString("en-IN") },
  { key: "eff", header: "Efficiency", align: "right", render: (s) => `${s.efficiency}%` },
];

const logSchema = z.object({
  type: z.enum(["Preventive", "Corrective", "Breakdown", "Inspection", "Other"]),
  description: z.string().min(1, "Description is required"),
  technician: z.string().optional(),
  cost: z.coerce.number().min(0).optional(),
  nextServiceDate: z.string().optional(),
});

function ServiceLogForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: ServiceLogFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceLogFormValues>({
    resolver: zodResolver(logSchema),
    defaultValues: { type: "Preventive", description: "" },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Type *"
          options={["Preventive", "Corrective", "Breakdown", "Inspection", "Other"].map((t) => ({
            value: t,
            label: t,
          }))}
          {...register("type")}
        />
        <Input label="Technician" {...register("technician")} />
      </div>
      <Input label="Description *" error={errors.description?.message} {...register("description")} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cost (₹)" type="number" {...register("cost")} />
        <Input label="Next service due" type="date" {...register("nextServiceDate")} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Add log</Button>
      </div>
    </form>
  );
}

export function MachineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: machine, isLoading, isError, error } = useMachine(id);
  const { setStatus, addServiceLog } = useMachineMutations();
  const [logOpen, setLogOpen] = useState(false);
  useTrackRecent("Machine", `/machines/${id}`, machine ? `Machine ${machine.id}` : undefined);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !machine) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Machine not found"}
      </p>
    );
  }

  const toggleStatus = (next: "free" | "maintenance") =>
    setStatus.mutate(
      { id: id!, status: next },
      {
        onSuccess: () => toast(`Machine marked ${next}`, "success"),
        onError: (e) => toast(e instanceof ApiError ? e.message : "Status update failed", "error"),
      }
    );

  return (
    <>
      <Link to="/machines" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Machines
      </Link>
      <PageHeader
        title={`Machine ${machine.id}`}
        subtitle={machine.manufacturer}
        actions={
          <>
            {machine.status !== "maintenance" && machine.status !== "running" && (
              <Button variant="secondary" loading={setStatus.isPending} onClick={() => toggleStatus("maintenance")}>
                <Wrench className="h-4 w-4" /> Send to maintenance
              </Button>
            )}
            {machine.status === "maintenance" && (
              <Button variant="secondary" loading={setStatus.isPending} onClick={() => toggleStatus("free")}>
                <Play className="h-4 w-4" /> Mark free
              </Button>
            )}
          </>
        }
      />

      <Card className="p-6">
        <div className="mb-4">
          <StatusChip tone={statusTone[machine.status]}>{machine.status}</StatusChip>
        </div>
        <DescriptionList
          columns={3}
          items={[
            { label: "Manufacturer", value: machine.manufacturer },
            { label: "Heads", value: machine.heads },
            { label: "Hooks", value: machine.hooks },
            { label: "Running job", value: machine.currentJobNo },
            {
              label: "Purchased",
              value: machine.dateOfPurchase
                ? new Date(machine.dateOfPurchase).toLocaleDateString()
                : undefined,
            },
          ]}
        />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="font-semibold px-5 pt-5">Recent shifts</h3>
          <DataTable
            columns={shiftColumns}
            rows={machine.result ?? []}
            rowKey={(s) => s.id}
            emptyTitle="No shifts recorded"
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Service history</h3>
            <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}>
              <Plus className="h-4 w-4" /> Add log
            </Button>
          </div>
          {(machine.serviceLogs?.length ?? 0) === 0 ? (
            <EmptyState title="No service logs" description="Record maintenance work as it happens." />
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {machine.serviceLogs.map((log, i) => (
                <li key={log._id ?? i} className="py-3">
                  <div className="flex items-center gap-2">
                    <StatusChip
                      tone={log.type === "Breakdown" ? "danger" : log.type === "Preventive" ? "info" : "neutral"}
                    >
                      {log.type}
                    </StatusChip>
                    <span className="text-xs text-ink-400">
                      {new Date(log.date).toLocaleDateString()}
                    </span>
                    {log.cost ? (
                      <span className="ml-auto text-sm font-semibold tabular-nums">
                        ₹{log.cost.toLocaleString("en-IN")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm">{log.description}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {log.technician && <>By {log.technician} · </>}
                    {log.nextServiceDate && (
                      <>Next service {new Date(log.nextServiceDate).toLocaleDateString()}</>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Add service log">
        <ServiceLogForm
          submitting={addServiceLog.isPending}
          onCancel={() => setLogOpen(false)}
          onSubmit={(values) =>
            addServiceLog.mutate(
              { machineId: id!, body: values },
              {
                onSuccess: () => {
                  setLogOpen(false);
                  toast("Service log added", "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Failed to add log", "error"),
              }
            )
          }
        />
      </Modal>
    </>
  );
}
