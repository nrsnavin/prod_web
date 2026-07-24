import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEmployeeAttendance } from "./hooks";
import { AttendanceRecord } from "./api";

const iso = (d: Date) => d.toISOString().slice(0, 10);

const statusTone: Record<string, ChipTone> = {
  present: "success",
  late: "warning",
  half_day: "info",
  absent: "danger",
  on_leave: "neutral",
};

const columns: Column<AttendanceRecord>[] = [
  { key: "date", header: "Date", render: (r) => `${r.dateLabel} · ${r.dayOfWeek}` },
  { key: "shift", header: "Shift", render: (r) => <StatusChip tone={r.shift === "DAY" ? "info" : "neutral"}>{r.shift}</StatusChip> },
  { key: "status", header: "Status", render: (r) => <StatusChip tone={statusTone[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusChip> },
  { key: "in", header: "In / Out", render: (r) => (r.checkIn || r.checkOut ? `${r.checkIn || "—"} / ${r.checkOut || "—"}` : "—") },
  { key: "late", header: "Late (min)", align: "right", render: (r) => (r.lateMinutes ? r.lateMinutes : "—") },
  { key: "leave", header: "Leave", render: (r) => r.leaveType || "—" },
];

const stat = (label: string, value: string | number, tone?: string) => (
  <div className="rounded-lg border border-ink-200 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
    <p className={`text-lg font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
  </div>
);

export function EmployeeAttendanceCard({ empId }: { empId: string }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(iso(today));
  const [shift, setShift] = useState("all");

  const { data, isLoading, isError, error } = useEmployeeAttendance(empId, startDate, endDate, shift);
  const s = data?.summary;

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarRange className="h-4 w-4 text-ink-400" /> Attendance
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <Input label="From" type="date" value={startDate} max={endDate}
            onChange={(e) => setStartDate(e.target.value)} />
          <Input label="To" type="date" value={endDate} min={startDate} max={iso(today)}
            onChange={(e) => setEndDate(e.target.value)} />
          <Select label="Shift" value={shift} onChange={(e) => setShift(e.target.value)}
            options={[
              { value: "all", label: "All shifts" },
              { value: "day", label: "Day" },
              { value: "night", label: "Night" },
            ]} />
        </div>
      </div>

      {isError && (
        <p className="mt-3 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          {(error as Error).message}
        </p>
      )}

      {isLoading && !data ? (
        <Skeleton className="mt-4 h-24 w-full" />
      ) : s ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {stat("Attendance", `${s.attendancePct}%`, s.attendancePct >= 90 ? "text-status-success" : s.attendancePct < 60 ? "text-status-danger" : "")}
            {stat("Shifts", s.total)}
            {stat("Present", s.present, "text-status-success")}
            {stat("Late", s.late, "text-status-warning")}
            {stat("Half day", s.halfDay)}
            {stat("Absent", s.absent, "text-status-danger")}
            {stat("On leave", s.onLeave)}
          </div>
          {s.totalLateMinutes > 0 && (
            <p className="mt-2 text-xs text-ink-400">{s.totalLateMinutes} late minutes in this range.</p>
          )}
          <div className="mt-3">
            <DataTable
              columns={columns}
              rows={data!.records}
              rowKey={(r) => r.id}
              emptyTitle="No attendance in this range"
            />
          </div>
        </>
      ) : null}
    </Card>
  );
}
