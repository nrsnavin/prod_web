import { useState } from "react";
import { Brain, RotateCcw, ChevronDown, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { usePlannerWeights, useResetWeights } from "./hooks";
import type { WeightsReport } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHAT THE PLANNER HAS WORKED OUT ABOUT THIS PLANT
//
//  The optimiser minimises a weighted sum of late days, changeovers and
//  load imbalance. Those weights used to be constants somebody picked
//  once; they now move when an admin edits a plan before accepting it.
//
//  That is a system changing its own behaviour, so the whole panel is
//  built around one rule: it has to be possible to see what it learned,
//  where it learned it, and to switch it off. A learner nobody can
//  inspect is a learner nobody will leave running.
//
//  ── Read as exchange rates, not as scores ────────────────────────
//  The lateness weight is pinned and never learned — the objective's
//  scale is unidentifiable, so one term has to be held still or the
//  numbers drift without changing a single decision. That makes the
//  other two readable against it: "a changeover costs 0.4 of a late
//  day" is a sentence somebody on the floor can agree or disagree with,
//  which "W_CHANGE = 4.2" is not. The panel says it that way.
//
//  ── "Learning" and "in use" are different ────────────────────────
//  Below the warm-up threshold the weights ARE being updated but are
//  NOT being used — the planner still runs on the defaults. Showing a
//  learned number while the planner ignores it would be a lie in the
//  most convincing possible format, so both are on the page.
// ══════════════════════════════════════════════════════════════════

/** A weight as a fraction of a late day, which is the unit that means something. */
function exchangeRate(weight: number, lateWeight: number) {
  if (!lateWeight) return "—";
  const r = weight / lateWeight;
  return r >= 0.1 ? `${r.toFixed(2)} late days` : `${(r * 100).toFixed(1)}% of a late day`;
}

function Row({
  label, value, lateWeight, base, help,
}: { label: string; value: number; lateWeight: number; base: number; help: string }) {
  const moved = Math.abs(value - base) > 1e-9;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-ink-100 py-2 first:border-t-0">
      <div className="min-w-0">
        <span className="font-medium">{label}</span>
        <p className="text-xs text-ink-400">{help}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="tabular-nums font-medium">{exchangeRate(value, lateWeight)}</span>
        {moved && (
          <p className="text-xs text-ink-400 tabular-nums">
            was {exchangeRate(base, lateWeight)}
          </p>
        )}
      </div>
    </li>
  );
}

function Body({ data }: { data: WeightsReport }) {
  const [showHistory, setShowHistory] = useState(false);
  const w = data.active;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        {data.learned ? (
          <span className="text-status-success">
            Running on the objective it learned here
          </span>
        ) : (
          <span className="text-ink-500">
            Running on the starting objective
          </span>
        )}
        <span className="text-ink-400 tabular-nums">
          {data.observations} correction{data.observations === 1 ? "" : "s"} recorded
          {!data.learned && ` · ${data.needed} needed before they are used`}
        </span>
      </div>

      {!data.learned && data.observations > 0 && (
        // The distinction that stops this being a confident lie.
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-500">
          It is already learning from these, but the planner is still running on the
          starting numbers. A handful of corrections is a coincidence, and reshaping
          every plan in the plant on one is worse than waiting.
        </p>
      )}

      <ul className="mt-3">
        <Row
          label="A changeover costs"
          value={w.changeover}
          lateWeight={w.late}
          base={data.defaults.changeover}
          help="Switching a loom to a different elastic mid-queue."
        />
        <Row
          label="An idle loom costs"
          value={w.balance}
          lateWeight={w.late}
          base={data.defaults.balance}
          help="Per working day that the busiest loom runs beyond the average."
        />
      </ul>

      {data.history.length > 0 && (
        <>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHistory && "rotate-180")} />
            What it learned, and when
            <span className="font-normal text-ink-400">({data.history.length})</span>
          </button>

          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {data.history.map((h, i) => (
                <li key={i} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
                  <div className="flex flex-wrap justify-between gap-x-3 text-ink-400 tabular-nums">
                    <span>{new Date(h.at).toLocaleString("en-IN")}</span>
                    <span>{h.actor} · {h.lines} lines</span>
                  </div>
                  <p className="mt-0.5 text-ink-900">{h.note}</p>
                  <p className="mt-0.5 text-ink-400 tabular-nums">
                    offered {Math.round(h.proposed.late)}d late / {h.proposed.changeover} changeovers
                    {" → accepted "}
                    {Math.round(h.accepted.late)}d late / {h.accepted.changeover} changeovers
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-3 flex items-start gap-1.5 border-t border-ink-100 pt-3 text-xs text-ink-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Only the trade-off between plans is learned here. How fast each loom runs each
        elastic is learned separately, from closed shifts — from what the machines
        actually did, not from anybody's opinion about the schedule.
      </p>
    </>
  );
}

export function LearnedWeightsPanel() {
  const { data, isLoading } = usePlannerWeights();
  const reset = useResetWeights();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
            <Brain className="h-4 w-4" /> What the planner has learned
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-ink-400">
            Every time a plan is changed before it is accepted, that is a statement
            about what this plant would rather have. These are the numbers it has
            taken from those.
          </p>
        </div>
        {data && data.observations > 0 && (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
      </div>

      {isLoading ? <Skeleton className="mt-4 h-28 w-full" /> : data ? <Body data={data} /> : null}

      {confirming && (
        <ConfirmDialog
          open
          title="Reset the planner's objective?"
          message="Everything it has learned from accepted edits is discarded and the planner goes back to its starting numbers. The corrections themselves are not recoverable."
          confirmLabel="Reset"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            reset.mutate(undefined, {
              onSuccess: () => toast("Planner objective reset", "success"),
              onError: () => toast("Could not reset", "error"),
            });
            setConfirming(false);
          }}
        />
      )}
    </Card>
  );
}

export default LearnedWeightsPanel;
