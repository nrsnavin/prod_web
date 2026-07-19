import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Factory, Trash2, Fingerprint, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { payrollService } from "@/features/hr/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inr = (n: number | undefined) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

/**
 * Pay & performance overview for one employee: shift rates, the selected
 * month's computed payroll (attendance, earnings, bonuses, deductions,
 * net), production output, and wastage — all from one read-only backend
 * call. Rendered on the employee detail page for admin/finance.
 */
export function EmployeePayrollCard({ empId }: { empId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-overview", empId, year, month],
    queryFn: () => payrollService.employeeOverview(empId, year, month),
    retry: false,
  });

  // Finance/admin only endpoint — anyone else simply doesn't get the card.
  if (isError) return null;

  const p = data?.payroll;

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Wallet className="h-4 w-4 text-brand-500" /> Pay &amp; month overview
        </h3>
        <div className="flex items-center gap-2">
          <Select
            value={String(month)}
            onChange={(e) => setMonth(Number(e.target.value))}
            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
          <Select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
          />
          <Link
            to="/payroll"
            className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            Payroll <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : (
        <>
          {/* Rates */}
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-canvas p-4 sm:grid-cols-4">
            <Stat label="Hourly rate" value={inr(data.employee.hourlyRate)} />
            <Stat label="DAY shift (12h)" value={inr(data.shiftRates.DAY)} />
            <Stat label="NIGHT shift (8h)" value={inr(data.shiftRates.NIGHT)} />
            <Stat
              label={`Net pay — ${MONTHS[month - 1]}`}
              value={inr(p?.netPay)}
              sub={p?.status ? `status: ${p.status}` : undefined}
            />
          </div>

          {/* Month money breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Gross earnings" value={inr(p?.grossEarnings)} />
            <Stat label="Bonuses" value={inr(p?.totalBonuses)} />
            <Stat label="Deductions" value={inr(p?.totalDeductions)} />
            <Stat label="Advance recovered" value={inr(p?.totalAdvanceDeduction)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Attendance */}
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <Fingerprint className="h-3.5 w-3.5" /> Attendance
              </p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between"><span className="text-ink-600">Present</span><span className="font-semibold tabular-nums">{p?.presentShifts ?? 0}</span></li>
                <li className="flex justify-between"><span className="text-ink-600">Half days</span><span className="font-semibold tabular-nums">{p?.halfDayShifts ?? 0}</span></li>
                <li className="flex justify-between"><span className="text-ink-600">Approved leave</span><span className="font-semibold tabular-nums">{p?.approvedLeaveShifts ?? 0}</span></li>
                <li className="flex justify-between"><span className="text-ink-600">Absent</span><span className="font-semibold tabular-nums text-status-danger">{p?.absentShifts ?? 0}</span></li>
                <li className="flex justify-between"><span className="text-ink-600">Late minutes</span><span className="font-semibold tabular-nums">{p?.totalLateMinutes ?? 0}</span></li>
              </ul>
            </div>

            {/* Production */}
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <Factory className="h-3.5 w-3.5" /> Production
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {data.production.totalMeters.toLocaleString("en-IN")} <span className="text-sm font-normal text-ink-400">m</span>
              </p>
              <p className="text-xs text-ink-400">across {data.production.shifts} shifts</p>
              <p className="mt-2 text-sm text-ink-600">
                {p ? `${p.dayShiftsWorked} day · ${p.nightShiftsWorked} night shifts worked` : ""}
              </p>
            </div>

            {/* Wastage */}
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <Trash2 className="h-3.5 w-3.5" /> Wastage
              </p>
              {data.wastage.entries.length === 0 ? (
                <p className="text-sm text-ink-400">No wastage this month 🎉</p>
              ) : (
                <>
                  <p className="text-sm">
                    {data.wastage.entries.length} entr{data.wastage.entries.length > 1 ? "ies" : "y"} ·{" "}
                    <StatusChip tone={data.wastage.totalPenalty > 0 ? "danger" : "neutral"}>
                      {inr(data.wastage.totalPenalty)} penalty
                    </StatusChip>
                  </p>
                  <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-ink-600">
                    {data.wastage.entries.slice(0, 6).map((w) => (
                      <li key={w._id} className="flex justify-between gap-2">
                        <span className="truncate">{w.reason || "Wastage"}</span>
                        <span className="shrink-0 tabular-nums">{w.penalty ? inr(w.penalty) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
