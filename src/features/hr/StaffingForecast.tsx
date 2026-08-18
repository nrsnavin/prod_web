import { useQuery } from "@tanstack/react-query";
import { Users, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { attendanceService, ForecastSlot, StaffingForecast as Forecast } from "./api";

// ══════════════════════════════════════════════════════════════════
//  HOW MANY PEOPLE WILL ACTUALLY BE HERE
//
//  The planner respects what each loom is busy with and ignores
//  staffing entirely — a machine with nobody on it produces the same as
//  a machine with a broken head. This is the other constraint.
//
//  ── The line this panel does not cross ───────────────────────────
//  No names. Not a name, not an initial, not a count of who was absent.
//  A per-person attendance figure on a shared screen becomes a league
//  table within a week and a reason somebody was let go within a
//  month — from a number that cannot tell an unreliable worker from one
//  who had a sick child in April.
//
//  A supervisor who needs a person's own record can see it with them on
//  the employee screen, which is separately gated. That is the right
//  place for it and this is not.
// ══════════════════════════════════════════════════════════════════

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function tone(pct: number | null) {
  if (pct == null) return "bg-ink-100";
  if (pct >= 90) return "bg-status-success";
  if (pct >= 75) return "bg-status-warning";
  return "bg-status-danger";
}

function SlotCell({ slot }: { slot: ForecastSlot | undefined }) {
  if (!slot) {
    return (
      <td className="px-2 py-2 text-center text-xs text-ink-300">—</td>
    );
  }
  return (
    <td className="px-2 py-2 text-center">
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-bold tabular-nums leading-none">{slot.planningHeads}</span>
        <span className="text-[11px] text-ink-400">of {slot.peopleRostered}</span>
        <div className="h-1.5 w-full max-w-[52px] overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn("h-full rounded-full", tone(slot.expectedAttendancePct))}
            style={{ width: `${slot.expectedAttendancePct ?? 0}%` }}
          />
        </div>
        {slot.thin && (
          <span className="text-[10px] text-ink-400" title="Most people here have few recorded shifts for this slot">
            thin
          </span>
        )}
      </div>
    </td>
  );
}

function Body({ data }: { data: Forecast }) {
  if (data.slots.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-400">
        {data.note ?? "Nothing recorded yet."}
      </p>
    );
  }

  const byKey = new Map(data.slots.map((s) => [`${s.day}|${s.shift}`, s]));

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-2xl font-bold tabular-nums">{data.plantAttendancePct}%</span>
          <span className="ml-2 text-ink-400">attendance across the plant</span>
        </span>
        <span className="text-ink-500 tabular-nums">{data.roster} on the production roster</span>
        {data.weakestSlot && (
          <span className="text-ink-500">
            Thinnest:{" "}
            <span className="font-medium text-ink-900">
              {data.weakestSlot.day} {data.weakestSlot.shift.toLowerCase()}
            </span>{" "}
            at {data.weakestSlot.expectedAttendancePct}%
          </span>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink-400">
              <th className="pb-2 pr-3 text-left font-medium">Shift</th>
              {DAY_ORDER.map((d) => (
                <th key={d} className="px-2 pb-2 text-center font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["DAY", "NIGHT"] as const).map((shift) => (
              <tr key={shift} className="border-t border-ink-100">
                <td className="py-2 pr-3 font-medium">{shift === "DAY" ? "Day" : "Night"}</td>
                {DAY_ORDER.map((d) => (
                  <SlotCell key={d} slot={byKey.get(`${d}|${shift}`)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-400">
        The large number is how many people to <strong>plan for</strong> — expected
        attendance rounded down. A plan built on the ninth person turning up is a plan
        that assumes full attendance.
      </p>

      <p className="mt-2 flex items-start gap-1.5 border-t border-ink-100 pt-3 text-xs text-ink-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {data.method}
      </p>
    </>
  );
}

export function StaffingForecast() {
  const { data, isLoading } = useQuery({
    queryKey: ["staffing-forecast"],
    queryFn: () => attendanceService.staffingForecast(),
    staleTime: 5 * 60_000,
  });

  return (
    <Card className="mb-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          <Users className="h-4 w-4" /> Expected staffing
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-ink-400">
          How many people the register suggests will be here, by day and shift. For
          building a plan against the crew you will actually have — not for comparing
          people, which is why no names appear here.
        </p>
      </div>

      {isLoading ? <Skeleton className="mt-4 h-40 w-full" /> : data ? <Body data={data} /> : null}
    </Card>
  );
}

export default StaffingForecast;
