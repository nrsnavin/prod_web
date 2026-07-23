import { useQuery } from "@tanstack/react-query";
import { CalendarOff, Wallet, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { leaveService, payrollService } from "@/features/hr/api";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const inr = (n: number | undefined) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

const payslipTone: Record<string, ChipTone> = {
  paid: "success",
  finalized: "info",
  draft: "neutral",
};
const leaveTone: Record<string, ChipTone> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
};

// Leave history, recent payslips, and outstanding (unpaid) salary for one
// employee — shown on the employee detail page for admin/finance.
export function EmployeeLeavePayCard({ empId }: { empId: string }) {
  const pay = useQuery({
    queryKey: ["employee-pay-history", empId],
    queryFn: () => payrollService.history(empId, 6),
    retry: false,
  });
  const leave = useQuery({
    queryKey: ["employee-leave", empId],
    queryFn: () => leaveService.byEmployee(empId),
    retry: false,
  });

  // Both endpoints are admin/finance (or self) gated; hide the card
  // entirely rather than showing an error to unauthorized viewers.
  if (pay.isError && leave.isError) return null;

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      {/* Pay: unpaid total + recent payslips */}
      <Card className="p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Wallet className="h-4 w-4 text-brand-500" /> Salary &amp; payslips
        </h3>

        {pay.isLoading ? (
          <Skeleton className="mt-3 h-24 w-full" />
        ) : pay.isError ? (
          <p className="mt-3 text-sm text-ink-400">Not available.</p>
        ) : (
          <>
            <div className="mt-3 rounded-lg bg-status-warningBg p-3">
              <p className="text-xs text-ink-400">Unpaid salary left</p>
              <p className="text-2xl font-bold tabular-nums text-status-warning">
                {inr(pay.data?.unpaidTotal)}
              </p>
              <p className="text-xs text-ink-400">
                {pay.data?.unpaidCount ?? 0} unpaid payslip
                {(pay.data?.unpaidCount ?? 0) === 1 ? "" : "s"}
              </p>
            </div>

            <h4 className="mt-4 flex items-center gap-1.5 text-sm font-medium text-ink-600">
              <ReceiptText className="h-3.5 w-3.5" /> Recent payslips
            </h4>
            {(pay.data?.payslips.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No payslips generated yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-ink-100">
                {pay.data!.payslips.map((p) => (
                  <li key={p._id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">
                      {MONTHS[(p.month ?? 1) - 1]} {p.year}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums font-semibold">{inr(p.netPay)}</span>
                      <StatusChip tone={payslipTone[p.status] ?? "neutral"}>{p.status}</StatusChip>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {/* Leave requests */}
      <Card className="p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarOff className="h-4 w-4 text-brand-500" /> Leave requests
        </h3>
        {leave.isLoading ? (
          <Skeleton className="mt-3 h-24 w-full" />
        ) : leave.isError ? (
          <p className="mt-3 text-sm text-ink-400">Not available.</p>
        ) : (leave.data?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-ink-400">No leave requests.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {leave.data!.slice(0, 8).map((l) => (
              <li key={l.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {l.dateLabel ?? (l.date ? new Date(l.date).toLocaleDateString() : "—")}
                  </span>
                  <StatusChip tone={leaveTone[l.status] ?? "neutral"}>{l.status}</StatusChip>
                </div>
                <p className="text-xs text-ink-400 capitalize">
                  {l.leaveType}
                  {l.shift ? ` · ${l.shift.toLowerCase()}` : ""}
                  {l.reason ? ` · ${l.reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
