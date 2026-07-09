import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useEmployee, useEmployeeMutations } from "./hooks";
import { EmployeeShiftRow } from "./types";
import { EmployeeForm } from "./EmployeeForm";

const shiftColumns: Column<EmployeeShiftRow>[] = [
  { key: "date", header: "Date", render: (s) => new Date(s.date).toLocaleDateString() },
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
  const { update, setPerformance } = useEmployeeMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [perf, setPerf] = useState<number | null>(null);

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

  return (
    <>
      <Link to="/employees" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Employees
      </Link>
      <PageHeader
        title={emp.name}
        subtitle={`${emp.department}${emp.role ? ` · ${emp.role}` : ""}`}
        actions={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <DescriptionList
            columns={3}
            items={[
              { label: "Phone", value: emp.phoneNumber },
              { label: "Department", value: <span className="capitalize">{emp.department}</span> },
              { label: "Role", value: emp.role },
              { label: "Aadhar", value: emp.aadhar },
              { label: "Skill", value: emp.skill },
              { label: "Total shifts", value: emp.totalShifts },
            ]}
          />
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Performance</h3>
          <p className="mt-1 text-3xl font-bold tabular-nums">{currentPerf}</p>
          <input
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

      <Card className="mt-4">
        <h3 className="font-semibold px-5 pt-5">Recent shifts</h3>
        <DataTable
          columns={shiftColumns}
          rows={emp.result ?? []}
          rowKey={(s) => s.id}
          emptyTitle="No shifts recorded"
        />
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit employee">
        <EmployeeForm
          initial={{
            name: emp.name,
            department: emp.department,
            phoneNumber: emp.phoneNumber,
            role: emp.role,
            aadhar: emp.aadhar,
          }}
          submitting={update.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={(values) =>
            update.mutate(
              { id: emp.id, body: values },
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
      </Modal>
    </>
  );
}
