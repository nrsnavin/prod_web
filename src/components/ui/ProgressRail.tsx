import { ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { Card } from "./Card";
import { cn } from "./cn";
import { useIsPhone } from "@/core/hooks/useMediaQuery";

// ══════════════════════════════════════════════════════════════════
//  WHERE A PROCESS STANDS
//
//  Some work runs over days and through several people: an order from
//  approval to payment, an invoice to its e-way bill, a stock count, the
//  month end, the payroll. A rail at the top of its page says what is
//  done, where it stands and what comes next, so nobody has to carry the
//  order of the steps in their head.
//
//  Each step's state comes from the record itself, never from a button
//  somebody pressed: a rail that can say "done" while the figures say
//  otherwise would be worse than none.
// ══════════════════════════════════════════════════════════════════

export type RailState = "done" | "current" | "todo" | "skipped";

export interface RailStep {
  key: string;
  label: string;
  /** A figure or date under the label: "42 slips", "3,500 of 14,000 m". */
  detail?: ReactNode;
  state: RailState;
}

/** What a step says to a screen reader, after its label. */
const SAY: Record<RailState, string> = { done: "done", current: "current step", todo: "to do", skipped: "skipped" };

/**
 * States from facts: each step says whether it is done (or does not
 * apply); the first one that is neither is where the process stands, and
 * the rest wait. A later step can be done before an earlier one (a month
 * end's checks come in any order) and still shows as done.
 */
export function settle(
  steps: Array<{ key: string; label: string; detail?: ReactNode; done: boolean; skipped?: boolean }>
): RailStep[] {
  let found = false;
  return steps.map(({ done, skipped, ...s }) => {
    if (done) return { ...s, state: "done" as const };
    if (skipped) return { ...s, state: "skipped" as const };
    if (!found) {
      found = true;
      return { ...s, state: "current" as const };
    }
    return { ...s, state: "todo" as const };
  });
}

const LABEL: Record<RailState, string> = {
  done: "text-ink-700",
  current: "font-semibold text-ink-900",
  todo: "text-ink-500",
  skipped: "text-ink-400",
};

const BAR: Record<RailState, string> = {
  done: "bg-accent",
  current: "bg-brand-400",
  todo: "bg-ink-200",
  skipped: "bg-ink-100",
};

function Dot({ state, n }: { state: RailState; n: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
        state === "done" && "bg-accent text-white",
        state === "current" && "border-2 border-accent bg-surface text-brand-600",
        state === "todo" && "border border-ink-300 bg-surface text-ink-500",
        state === "skipped" && "border border-dashed border-ink-300 bg-surface text-ink-400"
      )}
    >
      {state === "done" ? <Check className="h-3.5 w-3.5" /> : state === "skipped" ? <Minus className="h-3.5 w-3.5" /> : n}
    </span>
  );
}

export function ProgressRail({
  label,
  steps,
  aside,
  className,
}: {
  /** The process, as its heading: "Order progress", "Payroll · November 2026". */
  label: string;
  steps: RailStep[];
  /** Beside the heading: a link to the step's work, say. */
  aside?: ReactNode;
  className?: string;
}) {
  const phone = useIsPhone();
  const n = steps.length;
  const at = steps.findIndex((s) => s.state === "current");

  // On a phone seven labels side by side would be unreadable: the rail
  // becomes a bar of segments with the step it stands at written out.
  if (phone) {
    const cur = at >= 0 ? steps[at] : null;
    return (
      <Card className={cn("p-4", className)}>
        <section aria-label={label}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink-900">{label}</h2>
            <span className="shrink-0 text-xs tabular-nums text-ink-500">{cur ? `Step ${at + 1} of ${n}` : "All done"}</span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {steps.map((s) => (
              <span key={s.key} className={cn("h-1.5 flex-1 rounded-full", BAR[s.state])} />
            ))}
          </div>
          {cur && (
            <>
              <p className="mt-2 text-sm font-medium text-ink-900">{cur.label}</p>
              {cur.detail && <p className="text-xs text-ink-500">{cur.detail}</p>}
            </>
          )}
          <ol className="sr-only">
            {steps.map((s) => (
              <li key={s.key}>{`${s.label}: ${SAY[s.state]}`}</li>
            ))}
          </ol>
          {aside && <div className="mt-3">{aside}</div>}
        </section>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <section aria-label={label}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-900">{label}</h2>
          {aside}
        </div>
        <ol className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => (
            <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className="min-w-0">
              <div className="flex items-center gap-2">
                <Dot state={s.state} n={i + 1} />
                {i < n - 1 && (
                  <span aria-hidden className={cn("h-0.5 flex-1 rounded-full", s.state === "done" ? "bg-accent" : "bg-ink-200")} />
                )}
              </div>
              <p className={cn("mt-2 text-sm leading-snug", LABEL[s.state])}>{s.label}</p>
              <span className="sr-only">{SAY[s.state]}</span>
              {s.detail && <p className="mt-0.5 text-xs leading-snug tabular-nums text-ink-500">{s.detail}</p>}
            </li>
          ))}
        </ol>
      </section>
    </Card>
  );
}
