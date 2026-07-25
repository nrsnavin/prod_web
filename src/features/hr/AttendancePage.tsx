import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { attendanceService, AttendanceRecord } from "./api";
import { ShiftTimerPanel } from "./ShiftTimerPanel";
import { toISODate } from "@/features/analytics/components/FilterBar";

function fmtWorked(mins?: number): string {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

const statusTone: Record<string, ChipTone> = {
  present: "success",
  late: "warning",
  half_day: "warning",
  absent: "danger",
  on_leave: "neutral",
};

const STATUS_OPTIONS = ["present", "late", "half_day", "absent", "on_leave"];

const columns: Column<AttendanceRecord>[] = [
  {
    key: "name",
    header: "Employee",
    render: (r) => (
      <div>
        <p className="font-medium">{r.employee?.name ?? r.name ?? "—"}</p>
        <p className="text-xs text-ink-400 capitalize">
          {r.employee?.department ?? r.department ?? ""}
        </p>
      </div>
    ),
  },
  { key: "shift", header: "Shift", render: (r) => r.shift ?? "—" },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <StatusChip tone={statusTone[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusChip>
    ),
  },
  { key: "in", header: "In", render: (r) => r.checkIn || "—" },
  { key: "out", header: "Out", render: (r) => r.checkOut || "—" },
  {
    key: "worked",
    header: "Worked",
    align: "right",
    render: (r) => <span className="tabular-nums">{fmtWorked(r.workedMinutes)}</span>,
  },
  {
    key: "late",
    header: "Late (min)",
    align: "right",
    render: (r) => (r.lateMinutes ? <span className="text-status-warning">{r.lateMinutes}</span> : "—"),
  },
  { key: "notes", header: "Notes", render: (r) => r.notes || r.leaveType || "—" },
];

function MarkModal({
  date,
  shift,
  unmarked,
  onClose,
}: {
  date: string;
  shift: "DAY" | "NIGHT";
  unmarked: Array<{ id: string; name: string; department?: string }>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(unmarked.map((e) => [e.id, "present"]))
  );
  const [ot, setOt] = useState<Record<string, string>>({});
  const [checkIn, setCheckIn] = useState<Record<string, string>>({});
  const [checkOut, setCheckOut] = useState<Record<string, string>>({});
  const mark = useMutation({
    mutationFn: attendanceService.mark,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  return (
    <FormScreen open onClose={onClose} title={`Mark attendance — ${shift} shift`} width="max-w-3xl">
      <p className="mb-2 text-xs text-ink-400">
        Enter In/Out times to pay actual hours worked (capped at 12h). Leave blank to pay a full 12h shift.
      </p>
      <div className="grid grid-cols-[1fr_120px_84px_84px_72px] gap-2 px-1 pb-1 text-xs font-medium text-ink-400">
        <span>Employee</span><span>Status</span><span>In</span><span>Out</span><span className="text-right">OT min</span>
      </div>
      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {unmarked.map((e) => {
          const worked = statuses[e.id] === "present" || statuses[e.id] === "late" || statuses[e.id] === "half_day";
          return (
            <div key={e.id} className="grid grid-cols-[1fr_120px_84px_84px_72px] gap-2 items-center">
              <div>
                <p className="text-sm font-medium">{e.name}</p>
                <p className="text-xs text-ink-400 capitalize">{e.department ?? ""}</p>
              </div>
              <Select
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace("_", " ") }))}
                value={statuses[e.id]}
                onChange={(ev) => setStatuses((st) => ({ ...st, [e.id]: ev.target.value }))}
              />
              <input
                type="time"
                title="Clock-in time"
                disabled={!worked}
                value={worked ? checkIn[e.id] ?? "" : ""}
                onChange={(ev) => setCheckIn((c) => ({ ...c, [e.id]: ev.target.value }))}
                className="h-9 w-full rounded-lg border border-ink-200 bg-white px-1.5 text-sm tabular-nums disabled:bg-ink-100 disabled:text-ink-400"
              />
              <input
                type="time"
                title="Clock-out time"
                disabled={!worked}
                value={worked ? checkOut[e.id] ?? "" : ""}
                onChange={(ev) => setCheckOut((c) => ({ ...c, [e.id]: ev.target.value }))}
                className="h-9 w-full rounded-lg border border-ink-200 bg-white px-1.5 text-sm tabular-nums disabled:bg-ink-100 disabled:text-ink-400"
              />
              <input
                type="number"
                min={0}
                placeholder="OT"
                title="Overtime minutes (used only when no In/Out times given)"
                disabled={!worked}
                value={worked ? ot[e.id] ?? "" : ""}
                onChange={(ev) => setOt((o) => ({ ...o, [e.id]: ev.target.value }))}
                className="h-9 w-full rounded-lg border border-ink-200 bg-white px-2 text-sm tabular-nums disabled:bg-ink-100 disabled:text-ink-400"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          loading={mark.isPending}
          onClick={() =>
            mark.mutate(
              {
                date,
                shift,
                records: Object.entries(statuses).map(([employeeId, status]) => ({
                  employeeId,
                  status,
                  overtimeMinutes: Number(ot[employeeId]) || 0,
                  checkIn: checkIn[employeeId] || undefined,
                  checkOut: checkOut[employeeId] || undefined,
                })),
              },
              {
                onSuccess: () => {
                  toast("Attendance marked", "success");
                  onClose();
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Failed to mark attendance", "error"),
              }
            )
          }
        >
          <UserCheck className="h-4 w-4" /> Mark {unmarked.length} employees
        </Button>
      </div>
    </FormScreen>
  );
}

export function AttendancePage() {
  const [date, setDate] = useState(toISODate(new Date()));
  const [shift, setShift] = useState<"all" | "DAY" | "NIGHT">("all");
  const [markOpen, setMarkOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance", date, shift],
    queryFn: () => attendanceService.byDate(date, shift),
  });

  const b = data?.breakdown ?? {};

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Mark and review daily attendance per shift."
        actions={
          (data?.unmarked.length ?? 0) > 0 && (
            <Button onClick={() => setMarkOpen(true)}>
              <UserCheck className="h-4 w-4" /> Mark {data!.unmarked.length} unmarked
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          max={toISODate(new Date())}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-lg border border-ink-200 px-3 text-sm bg-white focus:outline-none focus:border-brand-500"
        />
        <FilterChips
          options={[
            { value: "all", label: "Both shifts" },
            { value: "DAY", label: "Day" },
            { value: "NIGHT", label: "Night" },
          ]}
          value={shift}
          onChange={setShift}
        />
      </div>

      {date === toISODate(new Date()) && <ShiftTimerPanel date={date} />}

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <Skeleton className="h-24 w-full mb-4" />
      ) : (
        <div className="mb-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Present", val: b.present ?? 0 },
            { label: "Late", val: b.late ?? 0 },
            { label: "Half day", val: b.half_day ?? 0 },
            { label: "Absent", val: b.absent ?? 0 },
            { label: "On leave", val: b.on_leave ?? 0 },
            { label: "Unmarked", val: data?.totalUnmarked ?? 0 },
          ].map((t) => (
            <Card key={t.label} className="p-3">
              <p className="text-xs text-ink-400">{t.label}</p>
              <p className="text-xl font-bold tabular-nums">{t.val}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.records ?? []}
          rowKey={(r) => r._id ?? r.id ?? `${r.employee?._id}-${r.shift}`}
          loading={isLoading}
          emptyTitle="No attendance marked"
          emptyDescription="Pick a date or mark the unmarked employees."
        />
      </Card>

      {markOpen && data && (
        <MarkModal
          date={date}
          shift={shift === "all" ? "DAY" : shift}
          unmarked={data.unmarked}
          onClose={() => setMarkOpen(false)}
        />
      )}
    </>
  );
}
