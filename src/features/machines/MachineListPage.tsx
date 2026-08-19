import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { FloorBoard } from "./FloorBoard";
import { ServiceAnalyticsPanel } from "./ServiceAnalyticsPanel";
import { Machine, MachineFormValues, MachineStatus } from "./types";

const statusTone: Record<MachineStatus, ChipTone> = {
  running: "success",
  free: "info",
  maintenance: "warning",
};

/**
 * The job a machine is running, as a link to it.
 *
 * Named "J-1042" and linked, the same as the machine detail page — two
 * screens naming the same job differently is its own small bug.
 *
 * A bare string means the route did not populate the reference, so the
 * number is not available: a dash is the honest answer there, and an
 * id rendered as a job number would not be.
 */
/**
 * The job number this loom is running, or null.
 *
 * Shared by the cell and the sort accessor deliberately. Read twice with
 * two guards, a row could show a dash while sorting as though it had a
 * job — a list that disagrees with itself about what is in it.
 */
function runningJobNo(m: Machine): string | null {
  const job = m.orderRunning;
  if (!job || typeof job !== "object") return null;
  if (job.jobOrderNo == null) return null;
  return String(job.jobOrderNo);
}

function RunningJob({ machine: m }: { machine: Machine }) {
  const job = m.orderRunning;
  const none = <span className="text-ink-400">—</span>;

  if (runningJobNo(m) === null) return none;
  if (typeof job !== "object" || !job) return none;

  const label = `J-${job.jobOrderNo}`;
  if (!job._id) return <span className="font-medium">{label}</span>;

  return (
    <Link
      to={`/jobs/${job._id}`}
      // The row itself navigates to the machine; without this, opening
      // the job would bounce straight to the machine page instead.
      onClick={(e) => e.stopPropagation()}
      className="font-medium text-brand-600 hover:underline"
    >
      {label}
    </Link>
  );
}

// Every column sorts. A machine list is read to answer "which loom",
// "which is free", "which is big enough" — and each of those is a
// different ordering of the same twenty rows.
//
// Machine ID sorts naturally rather than as text, so LOOM-2 comes before
// LOOM-10 instead of after it. The rule lives in DataTable's comparator
// and applies to every identifier in the app.
const columns: Column<Machine>[] = [
  {
    key: "id",
    header: "Machine",
    render: (m) => <span className="font-medium">{m.ID}</span>,
    // Just the string. DataTable compares with numeric collation, which
    // already orders "1", "2", "10" arithmetically AND keeps LOOM-2
    // before LOOM-10 — a numeric accessor here was tried and changed
    // nothing, so it was removed rather than left as decoration.
    sort: (m) => m.ID ?? "",
  },
  {
    key: "make",
    header: "Manufacturer",
    render: (m) => m.manufacturer,
    sort: (m) => m.manufacturer ?? "",
  },
  {
    key: "heads",
    header: "Heads",
    align: "right",
    render: (m) => m.NoOfHead,
    sort: (m) => m.NoOfHead ?? 0,
  },
  {
    key: "hooks",
    header: "Hooks",
    align: "right",
    render: (m) => m.NoOfHooks,
    sort: (m) => m.NoOfHooks ?? 0,
  },
  {
    key: "job",
    header: "Running job",
    render: (m) => <RunningJob machine={m} />,
    // Idle looms have no job number, so they gather at one end rather
    // than scattering through the list.
    sort: (m) => runningJobNo(m) ?? "",
  },
  {
    key: "status",
    header: "Status",
    render: (m) => <StatusChip tone={statusTone[m.status]}>{m.status}</StatusChip>,
    sort: (m) => m.status ?? "",
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-2.5 py-1 text-xs font-medium hover:border-ink-400"
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

      {/* The floor first. The question somebody walks up to this screen
          with is "what is running", and a status chip in the sixth
          column of a forty-row table makes them count. */}
      <div className="mb-4">
        <FloorBoard machines={data ?? []} loading={isLoading} />
      </div>

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
        <h3 className="px-5 pt-5 text-sm font-semibold text-ink-900">Every machine</h3>
        <DataTable
          columns={columns}
          // Opens in machine order rather than whatever order the server
          // happened to return — the first question anybody asks of this
          // screen is "where is LOOM-7".
          defaultSortKey="id"
          rows={data ?? []}
          rowKey={(m) => m._id}
          onRowClick={(m) => navigate(`/machines/${m._id}`)}
          loading={isLoading}
          emptyTitle="No machines found"
        />
      </Card>

      {/* Money and patterns last: what somebody comes to this screen for
          deliberately, not what they glance at on the way past. */}
      <div className="mt-4">
        <ServiceAnalyticsPanel />
      </div>

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
