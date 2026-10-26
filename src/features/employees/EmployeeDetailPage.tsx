import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, RotateCcw, UserMinus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useEmployee, useEmployeeMutations } from "./hooks";
import { EmployeeShiftRow, OFFBOARD_REASON_LABELS } from "./types";
import { OffboardDialog } from "./OffboardDialog";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeePayrollCard } from "./EmployeePayrollCard";
import { EmployeeLeavePayCard } from "./EmployeeLeavePayCard";
import { EmployeeAttendanceCard } from "./EmployeeAttendanceCard";
import { EmployeeBonusCard } from "./EmployeeBonusCard";
import { SkillProfileCard } from "./SkillProfileCard";
import { WorkerAccessCard } from "./WorkerAccessCard";
import { AadhaarValue } from "./AadhaarValue";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "@/app/navigation";
import { formatDate } from "@/core/format/date";

const shiftColumns: Column<EmployeeShiftRow>[] = [
  { key: "date", header: "Date", render: (s) => formatDate(s.date) },
  {
    key: "shift",
    header: "Shift",
    render: (s) => (
      <StatusChip tone={s.shift === "DAY" ? "info" : "neutral"}>{s.shift}</StatusChip>
    ),
  },
  { key: "machine", header: "Machine", render: (s) => s.machine },
  { key: "runtime", header: "Runtime (min)", align: "right", render: (s) => s.runtimeMinutes },
  { key: "output", header: "Output (m)", align: "right", render: (s) => s.outputMeters.toLocaleString("en-IN") },
  { key: "eff", header: "Efficiency", align: "right", render: (s) => `${s.efficiency}%` },
];

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: emp, isLoading, isError, error } = useEmployee(id);
  const { update, setPerformance, reinstate } = useEmployeeMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  // The version the edit form opened on, captured then rather than read
  // at save time: a background refetch would otherwise hand the save a
  // newer version than the one the person was looking at.
  const [editVersion, setEditVersion] = useState<number | undefined>(undefined);
  const [perf, setPerf] = useState<number | null>(null);
  const { user } = useAuth();
  // Giving a worker a login is an admin's, through the Users permission.
  const canGrantAccess = user?.role === "admin" && canAccessPath("/users", user);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !emp) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Employee not found"}
      </p>
    );
  }

  const currentPerf = perf ?? emp.performance ?? 0;
  const isAdmin = user?.role === "admin";
  const left = emp.status === "offboarded";
  const off = emp.offboarding;

  return (
    <>
      <Link to="/employees" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Employees
      </Link>
      <PageHeader
        title={emp.name}
        subtitle={`${emp.department}${emp.role ? ` · ${emp.role}` : ""}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setEditVersion(emp.__v); setEditOpen(true); }}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {/* Offboarding and rehiring are the admin's, like registering. */}
            {isAdmin && !left && (
              <Button variant="secondary" onClick={() => setOffboardOpen(true)}>
                <UserMinus className="h-4 w-4" /> Offboard
              </Button>
            )}
            {isAdmin && left && (
              <Button variant="secondary" onClick={() => setReinstateOpen(true)}>
                <RotateCcw className="h-4 w-4" /> Reinstate
              </Button>
            )}
          </>
        }
      />

      {left && off && (
        <div role="status" className="mb-4 rounded-lg border border-status-warning/40 bg-status-warningBg px-4 py-3 text-sm">
          <p className="font-semibold text-status-warning">
            {off.lastWorkingDay && new Date(off.lastWorkingDay).getTime() >= new Date(new Date().toDateString()).getTime()
              ? `Leaving — last working day ${formatDate(off.lastWorkingDay)}`
              : `Left — last working day ${formatDate(off.lastWorkingDay)}`}
            {off.reason ? ` · ${OFFBOARD_REASON_LABELS[off.reason] ?? off.reason}` : ""}
          </p>
          {off.note && <p className="mt-1 text-ink-600">{off.note}</p>}
          <p className="mt-1 text-xs text-ink-400">
            Recorded{off.recordedByName ? ` by ${off.recordedByName}` : ""}{off.recordedAt ? ` on ${formatDate(off.recordedAt)}` : ""}.
            Their records below are kept.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <DescriptionList
            columns={3}
            items={[
              { label: "Phone", value: emp.phoneNumber },
              { label: "Department", value: <span className="capitalize">{emp.department}</span> },
              { label: "Role", value: emp.role },
              {
                label: "Aadhaar",
                value: <AadhaarValue empId={emp.id} masked={emp.aadhar} canReveal={user?.role === "admin"} />,
              },
              { label: "Skill", value: emp.skill },
              { label: "Total shifts", value: emp.totalShifts },
            ]}
          />
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Performance</h3>
          <p className="mt-1 text-3xl font-bold tabular-nums">{currentPerf}</p>
          <input aria-label="Performance score"
            type="range"
            min={0}
            max={100}
            value={currentPerf}
            onChange={(e) => setPerf(Number(e.target.value))}
            className="mt-3 w-full accent-brand-500"
          />
          {perf != null && perf !== emp.performance && (
            <Button
              size="sm"
              className="mt-3 w-full"
              loading={setPerformance.isPending}
              onClick={() =>
                setPerformance.mutate(
                  { id: emp.id, performance: perf },
                  {
                    onSuccess: () => {
                      toast("Performance updated", "success");
                      setPerf(null);
                    },
                    onError: (e) =>
                      toast(e instanceof ApiError ? e.message : "Update failed", "error"),
                  }
                )
              }
            >
              Save performance
            </Button>
          )}
        </Card>
      </div>

      <ErrorBoundary variant="section" label="App access">
        {/* Someone who has left has no sign-in to give; reinstate them first. */}
        {canGrantAccess && !left && <WorkerAccessCard empId={emp.id} />}
      </ErrorBoundary>

      <ErrorBoundary variant="section" label="Skill profile">
        <SkillProfileCard empId={emp.id} profile={emp.skillProfile} />
      </ErrorBoundary>

      <ErrorBoundary variant="section" label="Pay">
        <EmployeePayrollCard empId={emp.id} />
      </ErrorBoundary>

      <ErrorBoundary variant="section" label="Bonus">
        <EmployeeBonusCard empId={emp.id} />
      </ErrorBoundary>

      <ErrorBoundary variant="section" label="Attendance">
        <EmployeeAttendanceCard empId={emp.id} />
      </ErrorBoundary>

      <ErrorBoundary variant="section" label="Leave and pay">
        <EmployeeLeavePayCard empId={emp.id} />
      </ErrorBoundary>

      {(emp.pastOffboardings?.length ?? 0) > 0 && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold">Earlier spells</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-600">
            {emp.pastOffboardings!.map((p, i) => (
              <li key={i}>
                Left {formatDate(p.lastWorkingDay)}
                {p.reason ? ` (${OFFBOARD_REASON_LABELS[p.reason] ?? p.reason})` : ""}
                {p.reinstatedAt ? `, reinstated ${formatDate(p.reinstatedAt)}` : ""}
                {p.note ? ` — ${p.note}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <h3 className="font-semibold px-5 pt-5">Recent shifts</h3>
        <DataTable
          columns={shiftColumns}
          rows={emp.result ?? []}
          rowKey={(s) => s.id}
          emptyTitle="No shifts recorded"
        />
      </Card>

      {offboardOpen && <OffboardDialog empId={emp.id} name={emp.name} onClose={() => setOffboardOpen(false)} />}

      <ReasonDialog
        open={reinstateOpen}
        onClose={() => setReinstateOpen(false)}
        title={`Reinstate ${emp.name}`}
        description="They become active again and can be put on shifts. When and why they left is kept. Phone sign-in is not turned back on; set a new PIN for them."
        tone="default"
        confirmLabel="Reinstate"
        loading={reinstate.isPending}
        onConfirm={(note) =>
          reinstate.mutate(
            { id: emp.id, note },
            {
              onSuccess: () => {
                setReinstateOpen(false);
                toast(`${emp.name} reinstated`, "success");
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Could not reinstate", "error"),
            }
          )
        }
      />

      <FormScreen open={editOpen} onClose={() => setEditOpen(false)} title="Edit employee">
        <EmployeeForm
          initial={{
            name: emp.name,
            department: emp.department,
            phoneNumber: emp.phoneNumber,
            role: emp.role,
            aadhar: undefined,
            hourlyRate: emp.hourlyRate,
            skillProfile: emp.skillProfile ?? undefined,
          }}
          aadhaarOnFile={emp.aadhar}
          canEditAadhaar={user?.role === "admin"}
          submitting={update.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={(values) =>
            update.mutate(
              { id: emp.id, body: { ...values, ...(editVersion === undefined ? {} : { expectedVersion: editVersion }) } },
              {
                onSuccess: () => {
                  setEditOpen(false);
                  toast("Employee updated", "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Update failed", "error"),
              }
            )
          }
        />
      </FormScreen>
    </>
  );
}
