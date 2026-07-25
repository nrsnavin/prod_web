import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, Timer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { attendanceService } from "./api";
import { payrollService } from "./api";

// HH:MM:SS elapsed since a start timestamp.
function elapsed(fromISO: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(fromISO).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function ShiftTimerPanel({ date }: { date: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [shift, setShift] = useState<"DAY" | "NIGHT">("DAY");
  const [employeeId, setEmployeeId] = useState("");
  // A once-a-second tick so the running timers count up live.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = useQuery({
    queryKey: ["attendance-active", date],
    queryFn: () => attendanceService.active(date),
    refetchInterval: 20_000,
  });
  const employees = useQuery({
    queryKey: ["payroll-employees"],
    queryFn: () => payrollService.payrollEmployees(),
  });

  const clockedInIds = useMemo(
    () => new Set((active.data ?? []).map((r) => String(r.employee?._id ?? r.employeeId ?? ""))),
    [active.data]
  );
  const options = (employees.data ?? [])
    .filter((e) => !clockedInIds.has(String(e.id)))
    .map((e) => ({ value: e.id, label: e.name }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["attendance-active"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
  };

  const clockIn = useMutation({
    mutationFn: attendanceService.clockIn,
    onSuccess: () => { toast("Clocked in", "success"); setEmployeeId(""); invalidate(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to clock in", "error"),
  });
  const clockOut = useMutation({
    mutationFn: attendanceService.clockOut,
    onSuccess: () => { toast("Clocked out — hours recorded", "success"); invalidate(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to clock out", "error"),
  });

  const rows = active.data ?? [];

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Timer className="h-4 w-4 text-brand-600" />
        <h3 className="font-semibold">Live shift timers</h3>
        <span className="text-xs text-ink-400">Pay follows actual hours worked (capped at 12h/shift)</span>
      </div>

      {/* Clock someone in */}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Select
            options={[{ value: "", label: employees.isLoading ? "Loading…" : "Select employee" }, ...options]}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>
        <FilterChips
          options={[
            { value: "DAY", label: "Day" },
            { value: "NIGHT", label: "Night" },
          ]}
          value={shift}
          onChange={(v) => setShift(v as "DAY" | "NIGHT")}
        />
        <Button
          disabled={!employeeId}
          loading={clockIn.isPending}
          onClick={() => clockIn.mutate({ employeeId, shift, date })}
        >
          <Play className="h-4 w-4" /> Clock in
        </Button>
      </div>

      {/* Running timers */}
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-ink-400">No one is currently clocked in.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((r) => (
            <li key={r.id ?? r._id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.employee?.name ?? r.name ?? "—"}</p>
                <p className="text-xs text-ink-400 capitalize">{r.employee?.department ?? ""}</p>
              </div>
              <StatusChip tone="neutral">{r.shift}</StatusChip>
              <span className="font-mono tabular-nums text-sm text-ink-900">
                {r.clockInAt ? elapsed(r.clockInAt, now) : "—"}
              </span>
              <Button
                variant="secondary"
                loading={clockOut.isPending}
                onClick={() =>
                  clockOut.mutate({
                    employeeId: String(r.employee?._id ?? r.employeeId ?? ""),
                    shift: (r.shift as "DAY" | "NIGHT") ?? "DAY",
                    date,
                  })
                }
              >
                <Square className="h-4 w-4" /> Clock out
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
