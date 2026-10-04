import { AlertTriangle, TrendingUp } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";
import { hoursMinutes, metres, useShiftExpectation } from "./api";

// ══════════════════════════════════════════════════════════════════
//  "EXPECTED ABOUT 180 m PER HEAD"
//
//  Under the metres on a production entry screen: what this loom should
//  make in the run time being typed, at the pick it is weaving, from its
//  own past shifts. When the figure typed is far outside that (fewer
//  than 1 shift in 50 would be), it asks for a second look: an extra
//  zero, the machine total typed instead of per head, the wrong run
//  time. It never blocks saving; a loom that broke down mid-shift really
//  does make half.
//
//  Shows nothing until there is a model and a run time, so a plant
//  without enough history sees the screen exactly as before.
// ══════════════════════════════════════════════════════════════════

type Props = {
  shiftId: string;
  /** As typed: "7:45", "7.45", or half-typed. */
  runTime: string;
  /** The metres per head typed so far, as text. */
  entered: string;
  /** The worker's own shift (reads through /me). */
  mine?: boolean;
};

/** An aid, never a dependency: if it fails, the entry form carries on without it. */
export function ExpectedOutput(props: Props) {
  return (
    <ErrorBoundary variant="hint" resetKey={props.shiftId}>
      <Expected {...props} />
    </ErrorBoundary>
  );
}

function Expected({
  shiftId,
  runTime,
  entered,
  mine = false,
}: Props) {
  const typed = useDebouncedValue(runTime, 300);
  const { data } = useShiftExpectation(shiftId, typed, { mine });
  const p = data?.available ? data.prediction : null;
  if (!p) return null;

  const value = entered.trim() === "" ? NaN : Number(entered);
  const off = Number.isFinite(value) && value > 0 ? (value < p.checkLow ? "low" : value > p.checkHigh ? "high" : null) : null;
  const fromShift = data?.runTimeFrom === "shift";

  return (
    <div className="space-y-1.5" data-testid="expected-output">
      <p className="flex items-start gap-1.5 text-xs text-ink-500">
        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
        <span>
          Expected about <span className="font-semibold text-ink-900 tabular-nums">{metres(p.perHead)}</span> per head{" "}
          <span className="tabular-nums">({metres(p.low)}–{metres(p.high)})</span> for{" "}
          {fromShift ? "the recorded " : ""}
          {hoursMinutes(p.minutes)} run time
          {p.basis === "plant" ? ", from the plant's typical loom" : ""}.
        </span>
      </p>
      {off && (
        <p role="status" className="flex items-start gap-1.5 rounded-lg bg-status-warningBg px-2.5 py-1.5 text-xs text-status-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {metres(value)} is {off === "low" ? "far below" : "far above"} what {data?.machine.code ?? "this loom"} usually
            makes in {hoursMinutes(p.minutes)}.{" "}
            {off === "high" && data && data.machine.heads > 1
              ? `Check it is per head, not the total for all ${data.machine.heads} heads, and check the run time.`
              : "Check the metres and the run time. If the loom really did stop, add a note."}
          </span>
        </p>
      )}
    </div>
  );
}
