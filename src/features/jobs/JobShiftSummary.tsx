import { StatusChip } from "@/components/ui/StatusChip";
import type { JobShiftSummary as Summary } from "./types";

/**
 * What this job's shifts add up to, above the list of them.
 *
 * The list answers "which shifts ran"; this answers "how much did they
 * make and how long did it take", without the reader totting up rows by
 * eye and getting it wrong.
 *
 * Two things are deliberately kept apart:
 *
 *  • A VERIFIED figure and a SUBMITTED one. Until an admin checks a
 *    shift, its output is the operator's own claim. Both are counted in
 *    the total — leaving them out would make a running job look idle —
 *    but the panel says how much of it is still unchecked, because a
 *    claim and a checked number are not the same fact.
 *  • Output per hour WORKED, not per hour rostered. Both shifts are 12h
 *    on paper; dividing by that would flatter a machine that stood idle
 *    for half of one.
 */
export function JobShiftSummary({ summary }: { summary: Summary | undefined }) {
  // An older server sends no summary at all; a job that has not run
  // sends zeroes. Neither should render a row of dashes.
  if (!summary || summary.shifts === 0) return null;

  const hours = Math.floor(summary.workedMinutes / 60);
  const mins = summary.workedMinutes % 60;

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: "Shifts",
      value: summary.shifts.toLocaleString("en-IN"),
      hint:
        summary.firstDateLabel && summary.lastDateLabel
          ? summary.firstDateLabel === summary.lastDateLabel
            ? summary.firstDateLabel
            : `${summary.firstDateLabel} – ${summary.lastDateLabel}`
          : undefined,
    },
    {
      label: "Produced",
      value: `${summary.produced.toLocaleString("en-IN")} m`,
      hint: `day ${summary.byShift.DAY.toLocaleString("en-IN")} · night ${summary.byShift.NIGHT.toLocaleString("en-IN")}`,
    },
    {
      label: "Time worked",
      value: `${hours}h ${String(mins).padStart(2, "0")}m`,
    },
    {
      label: "Per hour worked",
      value: `${summary.metresPerHour.toLocaleString("en-IN")} m`,
    },
  ];

  return (
    <div className="px-5 pb-1 pt-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-ink-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-ink-400">{s.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{s.value}</p>
            {s.hint && <p className="text-xs text-ink-400">{s.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {summary.closed > 0 && (
          <StatusChip tone="success">{summary.closed} verified</StatusChip>
        )}
        {summary.awaitingVerification > 0 && (
          <StatusChip tone="warning">
            {summary.awaitingVerification} awaiting verification
          </StatusChip>
        )}
        {summary.open > 0 && <StatusChip tone="neutral">{summary.open} not started</StatusChip>}
        {summary.awaitingVerification > 0 && (
          <span className="text-xs text-ink-400">
            {/* Say it plainly rather than hoping the chip carries it. */}
            Unverified shifts are counted at what the operator submitted.
          </span>
        )}
      </div>
    </div>
  );
}
