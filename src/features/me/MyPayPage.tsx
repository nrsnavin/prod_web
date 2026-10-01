import { useState } from "react";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatusChip } from "@/components/ui/StatusChip";
import { useMyAttendance, useMyEmployeeId, useMyLeaves, useMyPayslip } from "./hooks";
import { meService } from "./api";

// ══════════════════════════════════════════════════════════════════
//  PAY AND ATTENDANCE — the worker's own, one month at a time
// ══════════════════════════════════════════════════════════════════

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const rupees = (n: number | null | undefined) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const leaveTone = (s: string) => (s === "approved" ? "success" : s === "rejected" ? "danger" : "warning");

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className={strong ? "text-base font-semibold tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}

export function MyPayPage() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const shift = (d: number) =>
    setYm(({ year, month }) => {
      const m = month + d;
      return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m };
    });
  const isCurrent = ym.year === now.getFullYear() && ym.month === now.getMonth() + 1;

  const employeeId = useMyEmployeeId();
  const slip = useMyPayslip(ym.year, ym.month);
  const att = useMyAttendance(ym.year, ym.month);
  const leaves = useMyLeaves();
  const monthLeaves = (leaves.data ?? []).filter((l) => {
    const d = new Date(l.date);
    return d.getFullYear() === ym.year && d.getMonth() + 1 === ym.month;
  });

  return (
    <>
      <PageHeader title="Pay and attendance" subtitle="Your payslip, your days, and your leave." />

      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="rounded-lg border border-ink-200 bg-surface p-2 hover:border-ink-400">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="min-w-40 text-center font-semibold">{MONTHS[ym.month - 1]} {ym.year}</p>
        <button type="button" onClick={() => shift(1)} disabled={isCurrent} aria-label="Next month" className="rounded-lg border border-ink-200 bg-surface p-2 hover:border-ink-400 disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold">Payslip</h2>
            {slip.data && employeeId && (
              <a
                href={meService.payslipPdfUrl(employeeId, ym.year, ym.month)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600"
              >
                <FileDown className="h-4 w-4" aria-hidden /> PDF
              </a>
            )}
          </div>
          {slip.isLoading ? (
            <Skeleton className="mt-3 h-32 w-full" />
          ) : slip.isError ? (
            <ErrorState error={slip.error} what="your payslip" onRetry={() => slip.refetch()} />
          ) : !slip.data ? (
            <EmptyState compact title="Not ready yet" description={isCurrent ? "This month's payslip is made after the month closes." : "No payslip was made for this month."} />
          ) : (
            <dl className="mt-2 divide-y divide-ink-100">
              <Row label="Take-home pay" value={rupees(slip.data.netPay)} strong />
              <Row label="Earned" value={rupees(slip.data.grossEarnings)} />
              <Row label="Bonuses" value={rupees(slip.data.totalBonuses)} />
              <Row label="Deductions" value={`− ${rupees(slip.data.totalDeductions)}`} />
              {slip.data.totalAdvanceDeduction > 0 && <Row label="of which advances" value={rupees(slip.data.totalAdvanceDeduction)} />}
              <Row label="Shifts present" value={String(slip.data.presentShifts)} />
            </dl>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Attendance</h2>
          {att.isLoading ? (
            <Skeleton className="mt-3 h-32 w-full" />
          ) : att.isError || !att.data ? (
            <ErrorState error={att.error} what="your attendance" onRetry={() => att.refetch()} />
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Present", att.data.stats.present],
                ["Late", att.data.stats.late],
                ["Half day", att.data.stats.halfDay],
                ["Absent", att.data.stats.absent],
                ["On leave", att.data.stats.onLeave],
                ["Late minutes", att.data.stats.totalLateMin],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-lg bg-canvas px-2 py-2.5">
                  <p className="text-xl font-semibold tabular-nums">{n as number}</p>
                  <p className="text-xs text-ink-500">{label as string}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="font-semibold">Leave this month</h2>
        {leaves.isLoading ? (
          <Skeleton className="mt-3 h-16 w-full" />
        ) : monthLeaves.length === 0 ? (
          <EmptyState compact title="No leave requested this month" />
        ) : (
          <ul className="mt-2 divide-y divide-ink-100">
            {monthLeaves.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  {l.dateLabel} · {l.shift === "NIGHT" ? "Night" : "Day"} · <span className="capitalize">{l.leaveType}</span>
                  {l.reviewNotes && <span className="block text-xs text-ink-500">{l.reviewNotes}</span>}
                </span>
                <StatusChip tone={leaveTone(l.status)}>{l.status}</StatusChip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
