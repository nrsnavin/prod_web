import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Factory, Trash2, Fingerprint, ExternalLink, FileDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { payrollService, MonthRange } from "@/features/hr/api";
import { cn } from "@/components/ui/cn";

const statusTone: Record<string, ChipTone> = { paid: "success", finalized: "info", draft: "warning" };

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

function SlipRow({
  label,
  value,
  sub,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sub?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${sub ? "py-1.5 pl-4" : "py-2.5"}`}>
      <dt className={sub ? "text-xs text-ink-400" : "text-ink-600"}>{label}</dt>
      <dd
        className={`tabular-nums ${sub ? "text-xs text-ink-400" : "font-semibold"} ${
          positive ? "text-status-success" : negative ? "text-status-danger" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// Payroll across a month window for one employee: a totals strip plus a
// per-month slip table (with a per-month payslip PDF link).
function RangeSlips({ empId }: { empId: string }) {
  const { toast } = useToast();
  const now = new Date();
  const [range, setRange] = useState<MonthRange>(() => {
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return {
      fromYear: from.getFullYear(), fromMonth: from.getMonth() + 1,
      toYear: now.getFullYear(), toMonth: now.getMonth() + 1,
    };
  });
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["emp-range", empId, range],
    queryFn: () => payrollService.range(empId, range),
    retry: false,
  });
  const t = q.data?.totals;

  const downloadPdf = async (year: number, month: number) => {
    const key = `${year}-${month}`;
    setBusy(key);
    try {
      const blob = await payrollService.slipPdf(empId, year, month);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "No payslip for that month", "error");
    } finally {
      setBusy(null);
    }
  };

  const yearOpts = [0, 1, 2].map((d) => { const y = now.getFullYear() - d; return { value: String(y), label: String(y) }; });

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-400">From</span>
        <Select className="w-32" value={String(range.fromMonth)}
          onChange={(e) => setRange((r) => ({ ...r, fromMonth: Number(e.target.value) }))}
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Select className="w-24" value={String(range.fromYear)}
          onChange={(e) => setRange((r) => ({ ...r, fromYear: Number(e.target.value) }))} options={yearOpts} />
        <span className="text-ink-400">to</span>
        <Select className="w-32" value={String(range.toMonth)}
          onChange={(e) => setRange((r) => ({ ...r, toMonth: Number(e.target.value) }))}
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Select className="w-24" value={String(range.toYear)}
          onChange={(e) => setRange((r) => ({ ...r, toYear: Number(e.target.value) }))} options={yearOpts} />
      </div>

      {q.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-canvas p-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Net pay" value={inr(t?.netPay)} sub={`${t?.months ?? 0} months`} />
            <Stat label="Gross" value={inr(t?.grossEarnings)} />
            <Stat label="Bonuses" value={inr(t?.totalBonuses)} />
            <Stat label="Deductions" value={inr(t?.totalDeductions)} />
            <Stat label="Advances" value={inr(t?.totalAdvanceDeduction)} />
            <Stat label="Paid" value={inr(t?.amountPaid)} />
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-ink-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                  <th className="px-4 py-2 font-medium">Month</th>
                  <th className="px-4 py-2 text-right font-medium">Gross</th>
                  <th className="px-4 py-2 text-right font-medium">Deductions</th>
                  <th className="px-4 py-2 text-right font-medium">Net</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(q.data?.slips ?? []).map((sl) => (
                  <tr key={sl._id} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-2 font-medium">{MONTHS[sl.month - 1]} {sl.year}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{inr(sl.grossEarnings)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{inr(sl.totalDeductions)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{inr(sl.netPay)}</td>
                    <td className="px-4 py-2">
                      <StatusChip tone={statusTone[sl.status] ?? "neutral"}>
                        {sl.status.replace("_", " ")}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" loading={busy === `${sl.year}-${sl.month}`}
                        onClick={() => downloadPdf(sl.year, sl.month)}>
                        <FileDown className="h-4 w-4" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
                {(q.data?.slips?.length ?? 0) === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-400">
                    No generated payroll in this range.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
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
  const { toast } = useToast();
  const [view, setView] = useState<"month" | "range">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-overview", empId, year, month],
    queryFn: () => payrollService.employeeOverview(empId, year, month),
    retry: false,
  });

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await payrollService.slipPdf(empId, year, month);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "No generated payslip for this month yet",
        "error"
      );
    } finally {
      setDownloading(false);
    }
  };

  // Finance/admin only endpoint — anyone else simply doesn't get the card.
  if (isError) return null;

  const p = data?.payroll;

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Wallet className="h-4 w-4 text-brand-500" /> Pay &amp; month overview
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
            {(["month", "range"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded-md text-sm font-medium capitalize",
                  view === v ? "bg-white shadow-sm text-ink-900" : "text-ink-600"
                )}
              >
                {v === "month" ? "Month" : "Range"}
              </button>
            ))}
          </div>
          {view === "month" && (
            <>
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
              <Button variant="secondary" size="sm" loading={downloading} onClick={downloadPdf}>
                <FileDown className="h-4 w-4" /> Payslip PDF
              </Button>
            </>
          )}
          <Link
            to="/payroll"
            className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            Open in Payroll <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {view === "range" && <RangeSlips empId={empId} />}

      {view === "month" && (isLoading || !data ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : (
        <>
          {/* Rates */}
          <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg bg-canvas p-4">
            <Stat label="Hourly rate" value={inr(data.employee.hourlyRate)} />
            <Stat label="DAY shift (12h)" value={inr(data.shiftRates.DAY)} />
            <Stat label="NIGHT shift (12h)" value={inr(data.shiftRates.NIGHT)} />
          </div>

          {/* Salary slip — this month */}
          <div className="mt-4 rounded-lg border border-ink-200">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold">
                Salary slip · {MONTHS[month - 1]} {year}
              </p>
              {p?.status && (
                <StatusChip tone={statusTone[p.status] ?? "neutral"}>{p.status}</StatusChip>
              )}
            </div>
            <dl className="divide-y divide-ink-100 px-4 text-sm">
              <SlipRow label="Gross earnings" value={inr(p?.grossEarnings)} />
              {!!p?.overtimeEarnings && (
                <SlipRow sub label={`incl. overtime (${p.totalOvertimeMinutes ?? 0} min)`} value={`+ ${inr(p.overtimeEarnings)}`} />
              )}
              <SlipRow label="Bonuses" value={`+ ${inr(p?.totalBonuses)}`} positive />
              <SlipRow label="Deductions" value={`− ${inr(p?.totalDeductions)}`} negative />
              {!!p?.totalAdvanceDeduction && (
                <SlipRow sub label="advance recovery" value={inr(p.totalAdvanceDeduction)} />
              )}
              {!!p?.pfDeduction && <SlipRow sub label="PF" value={inr(p.pfDeduction)} />}
              {!!p?.esiDeduction && <SlipRow sub label="ESI" value={inr(p.esiDeduction)} />}
              <div className="flex items-center justify-between py-3">
                <dt className="font-semibold">Net pay</dt>
                <dd className="text-2xl font-bold tabular-nums">{inr(p?.netPay)}</dd>
              </div>
            </dl>
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
      ))}
    </Card>
  );
}
