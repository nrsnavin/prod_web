import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { bonusService } from "@/features/hr/api";

const inr = (n: number | null | undefined) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;

const TIER_TONE: Record<string, "success" | "info" | "warning" | "danger"> = {
  S: "success", A: "info", B: "warning", C: "danger",
};

/**
 * Live Diwali-bonus projection for one employee, computed from data as it
 * stands today: salary received across the bonus window, attendance tier,
 * eligibility, and the resulting amount. Once the year has been generated
 * the locked-in figure is shown alongside so the two can be compared.
 */
export function EmployeeBonusCard({ empId }: { empId: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["bonus-prediction", empId, year],
    queryFn: () => bonusService.prediction(empId, year),
    retry: false,
  });

  // Admin/finance-only endpoint — anyone else simply doesn't get the card.
  if (isError) return null;

  const p = data?.prediction;
  const diwali = data?.diwaliDate
    ? new Date(data.diwaliDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Gift className="h-4 w-4 text-brand-500" /> Diwali bonus projection
          {data?.approximate && <StatusChip tone="warning">projection</StatusChip>}
        </h3>
        <Select
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
          options={[0, 1, 2].map((d) => ({ value: String(currentYear - d), label: String(currentYear - d) }))}
          className="w-28"
        />
      </div>

      {isLoading || !data ? (
        <Skeleton className="mt-4 h-32 w-full" />
      ) : !data.configured ? (
        <p className="mt-3 text-sm text-ink-400">
          No Diwali date set for {year} — set it on the Bonus page to define the window.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-400">
            {data.bonusLabel || `Diwali ${year}`}
            {diwali && ` · ${diwali}`}
            {data.approximate
              ? " — figures grow as each month's payroll is paid."
              : " — it's the Diwali month; these are the final figures."}
          </p>

          {/* Headline projection */}
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-lg bg-canvas p-4">
            <div>
              <p className="text-xs text-ink-400">Projected bonus</p>
              {p?.eligible === false ? (
                <>
                  <p className="text-3xl font-bold tabular-nums text-ink-400">₹0</p>
                  <p className="mt-0.5 text-xs text-status-warning">
                    Under the {p.minDaysForEligibility ?? 30}-day eligibility threshold
                  </p>
                </>
              ) : (
                <p className="text-3xl font-bold tabular-nums">{inr(p?.bonusAmount)}</p>
              )}
            </div>
            {data.record && (
              <div className="text-right">
                <p className="text-xs text-ink-400">Generated</p>
                <p className="text-xl font-bold tabular-nums">{inr(data.record.bonusAmount)}</p>
                <StatusChip tone={data.record.status === "paid" ? "success" : "warning"}>
                  {data.record.status}
                </StatusChip>
              </div>
            )}
          </div>

          {/* How it was reached */}
          <dl className="mt-4 divide-y divide-ink-100 text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-ink-600">Window salary (bonus base)</dt>
              <dd className="font-medium tabular-nums">{inr(p?.annualEarnings)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-ink-600">Bonus percent</dt>
              <dd className="font-medium tabular-nums">{p?.bonusPercent ?? 0}%</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-ink-600">
                Attendance
                {p?.attendanceSource === "scheduled_shifts" && (
                  <span className="ml-1 text-xs text-ink-400">(from roster)</span>
                )}
              </dt>
              <dd className="flex items-center gap-2">
                <span className="tabular-nums text-ink-600">
                  {p?.attendanceDays ?? 0}/{p?.totalWorkingDays ?? 0} days · {p?.attendanceRate ?? 0}%
                </span>
                <StatusChip tone={TIER_TONE[p?.attendanceTier ?? "C"] ?? "neutral"}>
                  {p?.attendanceTier} ×{p?.multiplier}
                </StatusChip>
              </dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="flex items-center gap-1.5 text-ink-600">
                <TrendingUp className="h-3.5 w-3.5" /> Basis
              </dt>
              <dd className="text-ink-600">
                {p?.basedOn === "salary_received" ? "Actual payroll paid" : "Estimated from hours"}
              </dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  );
}
