import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Wrench, Play } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMachine, useMachineMutations, useServiceBills } from "./hooks";
import { MachineHealthCard } from "./MachineHealth";
import { MachineHeadMapEditModal } from "./MachineHeadMapEditModal";
import { ServiceBills } from "./ServiceBills";
import { MachineHeadElastic, MachineShiftRow, MachineStatus, ServiceLogFormValues } from "./types";
import { useTrackRecent } from "@/core/ui/uiStore";
import { Pencil } from "lucide-react";

const statusTone: Record<MachineStatus, ChipTone> = {
  running: "success",
  free: "info",
  maintenance: "warning",
};

// Minutes → "6h 30m", which reads faster than a raw 390 on a shift row.
function fmtRuntime(mins: number): string {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const shiftStatusTone: Record<MachineShiftRow["status"], ChipTone> = {
  closed: "success",
  pending_verification: "warning",
  running: "info",
  open: "neutral",
};

const shiftStatusLabel: Record<MachineShiftRow["status"], string> = {
  closed: "verified",
  pending_verification: "to verify",
  running: "running",
  open: "open",
};

const shiftColumns: Column<MachineShiftRow>[] = [
  { key: "date", header: "Date", render: (s) => new Date(s.date).toLocaleDateString() },
  {
    key: "shift",
    header: "Shift",
    render: (s) => <StatusChip tone={s.shift === "DAY" ? "info" : "neutral"}>{s.shift}</StatusChip>,
  },
  { key: "emp", header: "Operator", render: (s) => s.employee },
  {
    key: "status",
    header: "Status",
    // Without this an unverified shift's figures look like an idle machine.
    render: (s) => (
      <StatusChip tone={shiftStatusTone[s.status] ?? "neutral"}>
        {shiftStatusLabel[s.status] ?? s.status}
      </StatusChip>
    ),
  },
  {
    key: "runtime",
    header: "Runtime",
    align: "right",
    render: (s) => <span className="tabular-nums">{fmtRuntime(s.runtimeMinutes)}</span>,
  },
  {
    key: "output",
    header: "Output (m)",
    align: "right",
    render: (s) => <span className="tabular-nums">{s.outputMeters.toLocaleString("en-IN")}</span>,
  },
  {
    key: "eff",
    header: "Efficiency",
    align: "right",
    render: (s) => <span className="tabular-nums">{s.efficiency}%</span>,
  },
];

const headElasticColumns: Column<MachineHeadElastic>[] = [
  {
    key: "head",
    header: "Head",
    render: (h) => <span className="font-medium tabular-nums">#{h.head ?? "—"}</span>,
  },
  {
    key: "elastic",
    header: "Elastic",
    render: (h) =>
      h.elastic?.name ? (
        h.elastic.name
      ) : (
        <span className="text-ink-400">— unassigned —</span>
      ),
  },
];

const logSchema = z.object({
  type: z.enum(["Preventive", "Corrective", "Breakdown", "Inspection", "Other"]),
  description: z.string().min(1, "Description is required"),
  technician: z.string().optional(),
  cost: z.coerce.number().min(0).optional(),
  nextServiceDate: z.string().optional(),
  setMaintenance: z.boolean().optional(),
});

function ServiceLogForm({
  submitting,
  machineStatus,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  machineStatus: MachineStatus;
  onSubmit: (v: ServiceLogFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceLogFormValues>({
    resolver: zodResolver(logSchema),
    // Booking work in usually means the machine is coming off the floor, so
    // that is the default — except when it is already there.
    defaultValues: {
      type: "Preventive",
      description: "",
      setMaintenance: machineStatus === "free",
    },
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
        <Input label="Cost (₹)" type="number" {...register("cost")} hint="Or leave it to the bills" />
        <Input label="Next service due" type="date" {...register("nextServiceDate")} />
      </div>

      {/* Taking the machine off the floor is part of booking the work in,
          so it happens here rather than as a second, forgettable step. */}
      {machineStatus === "maintenance" ? (
        <p className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          This machine is already under maintenance.
        </p>
      ) : machineStatus === "running" ? (
        <p className="rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
          This machine is running a job. Stop the job first if it needs to come
          off the floor — the log can still be recorded now.
        </p>
      ) : (
        <label className="flex items-start gap-2.5 rounded-lg border border-ink-200 p-3">
          <input
            type="checkbox"
            {...register("setMaintenance")}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
          />
          <span>
            <span className="block text-sm font-medium">Send the machine to maintenance</span>
            <span className="block text-xs text-ink-400">
              Marks it unavailable for planning until you mark it free again.
            </span>
          </span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Save log</Button>
      </div>
    </form>
  );
}

export function MachineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: machine, isLoading, isError, error } = useMachine(id);
  const { setStatus, addServiceLog } = useMachineMutations();
  // One query for the whole machine, grouped per log below.
  const { data: bills, isLoading: billsLoading } = useServiceBills(id);
  const [logOpen, setLogOpen] = useState(false);
  const [mapEditOpen, setMapEditOpen] = useState(false);
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
            {
              label: "Running job",
              value: machine.currentJob?.id ? (
                <Link to={`/jobs/${machine.currentJob.id}`} className="text-brand-600 hover:underline">
                  J-{machine.currentJob.jobOrderNo ?? machine.currentJobNo}
                </Link>
              ) : machine.currentJobNo ? (
                `J-${machine.currentJobNo}`
              ) : undefined,
            },
            {
              label: "Purchased",
              value: machine.dateOfPurchase
                ? new Date(machine.dateOfPurchase).toLocaleDateString()
                : undefined,
            },
          ]}
        />
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-baseline gap-3">
            <h3 className="font-semibold">Head → elastic map</h3>
            <span className="text-xs text-ink-400">
              {(machine.elastics ?? []).filter((h) => h.elastic).length} of {machine.heads} heads threaded
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setMapEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit map
          </Button>
        </div>
        <DataTable
          columns={headElasticColumns}
          rows={machine.elastics ?? []}
          rowKey={(h) => `head-${h.head ?? "x"}-${h.elastic?._id ?? "none"}`}
          emptyTitle="No elastics threaded on this machine"
        />
      </Card>

      {mapEditOpen && id && (
        <MachineHeadMapEditModal
          machineId={id}
          heads={machine.heads}
          current={machine.elastics ?? []}
          jobId={machine.currentJob?.id ?? null}
          onClose={() => setMapEditOpen(false)}
        />
      )}

      {id && <MachineHealthCard machineId={id} />}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-baseline gap-3 px-5 pt-5">
            <h3 className="font-semibold">Recent shifts</h3>
            {(machine.result?.length ?? 0) > 0 && (
              <span className="text-xs text-ink-400">
                Last {machine.result.length}, newest first
              </span>
            )}
          </div>
          <DataTable
            columns={shiftColumns}
            rows={machine.result ?? []}
            rowKey={(s) => s.id}
            emptyTitle="No shifts recorded"
            emptyDescription="Shifts appear here once this machine is included in a shift plan."
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
              {machine.serviceLogs.map((log, i) => {
                const logBills = (bills ?? []).filter((b) => b.serviceLog === log._id);
                const billTotal = log.billTotal ?? 0;
                // A cost typed on the log and the bills attached to it are
                // entered separately, so surface the gap rather than letting
                // one silently contradict the other.
                const mismatch =
                  !!log.cost && billTotal > 0 && Math.round(billTotal) !== Math.round(log.cost);
                return (
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
                    {mismatch && (
                      <p className="mt-1 text-xs text-status-warning">
                        Bills total ₹{billTotal.toLocaleString("en-IN")}, but the log records
                        ₹{log.cost!.toLocaleString("en-IN")}.
                      </p>
                    )}
                    {id && log._id && (
                      <ServiceBills
                        machineId={id}
                        serviceLogId={log._id}
                        bills={logBills}
                        loading={billsLoading}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <FormScreen open={logOpen} onClose={() => setLogOpen(false)} title="Add service log">
        <ServiceLogForm
          submitting={addServiceLog.isPending}
          machineStatus={machine.status}
          onCancel={() => setLogOpen(false)}
          onSubmit={(values) =>
            addServiceLog.mutate(
              { machineId: id!, body: values },
              {
                onSuccess: (res) => {
                  setLogOpen(false);
                  toast(
                    res.statusChanged
                      ? "Service log added — machine sent to maintenance"
                      : "Service log added. Attach the bills to it below.",
                    "success"
                  );
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Failed to add log", "error"),
              }
            )
          }
        />
      </FormScreen>
    </>
  );
}
