import { useState, useEffect } from "react";
import {
  Wand2, Sparkles, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw,
  Clock, Repeat, Info,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useSuggestedPlan, useLatestPlan, useAcceptPlan } from "./hooks";
import { AcceptedPlanPanel } from "./AcceptedPlanPanel";
import { LearnedWeightsPanel } from "./LearnedWeightsPanel";
import { MachinePlan, PlanRow, RateSource, SuggestedPlan } from "./types";

const HORIZONS = [7, 14, 30];

const rateTone: Record<RateSource, "success" | "info" | "neutral"> = {
  posterior: "success",
  plant: "info",
  coldstart: "neutral",
};
const rateLabel: Record<RateSource, string> = {
  posterior: "learned rate",
  plant: "plant avg",
  coldstart: "cold-start",
};

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", tone)}>{value}</p>
    </Card>
  );
}

function SequenceRow({ row }: { row: PlanRow }) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-semibold tabular-nums">
        {row.sequence + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{row.elasticName}</span>
          {row.changeover && (
            <span className="inline-flex items-center gap-0.5 text-xs text-status-warning" title="Elastic changeover">
              <Repeat className="h-3 w-3" /> changeover
            </span>
          )}
        </p>
        <p className="text-xs text-ink-400">
          #{row.orderNo} · {row.customer} · {row.qtyMeters.toLocaleString("en-IN")} m · {row.heads} heads
        </p>
      </div>
      <StatusChip tone={rateTone[row.rateSource]}>{rateLabel[row.rateSource]}</StatusChip>
      <div className="w-32 shrink-0 text-right">
        <p className="flex items-center justify-end gap-1 tabular-nums">
          <Clock className="h-3.5 w-3.5 text-ink-400" />
          {row.weavingDays}d → {fmtDate(row.projectedFinish)}
        </p>
        {row.late ? (
          <StatusChip tone="danger">Late {row.lateWorkingDays}d</StatusChip>
        ) : (
          <span className="text-xs text-status-success">On time (due {fmtDate(row.dueDate)})</span>
        )}
      </div>
    </li>
  );
}

// ══════════════════════════════════════════════════════════════════
//  WHY THIS SCREEN CAN BE ARGUED WITH
//
//  Until now the planner offered a schedule and the only answers were
//  "accept" and "don't". That made the audit's central example —
//  "a planner accepts a schedule but moves two lines" — literally
//  impossible, and with it went the only signal that could ever correct
//  the objective. A system that cannot be disagreed with in a way it can
//  read cannot learn anything.
//
//  Two moves, because they are the two disagreements that mean
//  something: this run belongs on a different loom, and this run should
//  go before that one. Both are re-scored server-side on accept, so the
//  plan of record carries the finish dates of the schedule actually
//  chosen rather than the one that was offered.
// ══════════════════════════════════════════════════════════════════
function MachineCard({
  mp, otherMachines, onMove, onReorder,
}: {
  mp: MachinePlan;
  otherMachines: { machineId: string; machineID: string }[];
  onMove: (lineId: string, toMachineId: string) => void;
  onReorder: (machineId: string, index: number, dir: -1 | 1) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Machine {mp.machineID}</h3>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <span>{mp.heads} heads</span>
          {mp.changeovers > 0 && (
            <span className="flex items-center gap-1 text-status-warning">
              <Repeat className="h-3 w-3" /> {mp.changeovers} changeover{mp.changeovers > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <ul className="mt-1 divide-y divide-ink-100">
        {mp.rows.map((r, i) => (
          <li key={r.lineId || i}>
            <SequenceRow row={r} />
            <div className="flex flex-wrap items-center gap-2 pb-2 pl-1 text-xs">
              <button
                type="button"
                aria-label={`Move ${r.elasticName} earlier`}
                disabled={i === 0}
                onClick={() => onReorder(mp.machineId, i, -1)}
                className="rounded px-1.5 py-0.5 text-ink-500 hover:bg-surface-2 disabled:opacity-30"
              >
                ↑ earlier
              </button>
              <button
                type="button"
                aria-label={`Move ${r.elasticName} later`}
                disabled={i === mp.rows.length - 1}
                onClick={() => onReorder(mp.machineId, i, 1)}
                className="rounded px-1.5 py-0.5 text-ink-500 hover:bg-surface-2 disabled:opacity-30"
              >
                ↓ later
              </button>
              {otherMachines.length > 0 && (
                <label className="flex items-center gap-1 text-ink-400">
                  move to
                  <select
                    aria-label={`Move ${r.elasticName} to another machine`}
                    value=""
                    onChange={(e) => e.target.value && onMove(r.lineId, e.target.value)}
                    className="rounded border border-ink-200 bg-surface px-1 py-0.5 text-xs"
                  >
                    <option value="">…</option>
                    {otherMachines.map((m) => (
                      <option key={m.machineId} value={m.machineId}>{m.machineID}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PlanningPage() {
  const { toast } = useToast();
  const [horizon, setHorizon] = useState(7);
  const { data, isLoading, isFetching, isError, refetch } = useSuggestedPlan(horizon);
  const latest = useLatestPlan();
  const accept = useAcceptPlan();

  // The admin's version of the plan, or null while they have changed
  // nothing. Kept beside the proposal rather than replacing it: the
  // server needs BOTH to work out what the edit was, and the screen
  // needs the original to show that an edit happened at all.
  const [edited, setEdited] = useState<MachinePlan[] | null>(null);
  const shown = edited ?? data?.machines ?? [];

  // A fresh proposal invalidates any edit made against the previous one —
  // the line ids may not even exist any more.
  useEffect(() => { setEdited(null); }, [data?.generatedAt, horizon]);

  const moveLine = (lineId: string, toMachineId: string) => {
    const base = edited ?? data?.machines ?? [];
    const row = base.flatMap((m) => m.rows).find((r) => r.lineId === lineId);
    if (!row) return;
    setEdited(
      base.map((m) => ({
        ...m,
        rows:
          m.machineId === toMachineId
            ? [...m.rows.filter((r) => r.lineId !== lineId), row]
            : m.rows.filter((r) => r.lineId !== lineId),
      }))
    );
  };

  const reorder = (machineId: string, index: number, dir: -1 | 1) => {
    const base = edited ?? data?.machines ?? [];
    setEdited(
      base.map((m) => {
        if (m.machineId !== machineId) return m;
        const rows = [...m.rows];
        const j = index + dir;
        if (j < 0 || j >= rows.length) return m;
        [rows[index], rows[j]] = [rows[j], rows[index]];
        return { ...m, rows };
      })
    );
  };

  const onAccept = (plan: SuggestedPlan) => {
    accept.mutate({ plan, edited: edited ?? undefined }, {
      onSuccess: (res) => {
        toast(
          res.learning?.updated
            ? "Plan accepted — the planner took note of your changes"
            : "Plan accepted as the plan of record",
          "success"
        );
        setEdited(null);
        latest.refetch();
      },
      onError: (e) =>
        toast(e instanceof ApiError ? e.message : "Failed to accept plan", "error"),
    });
  };

  const obj = data?.objective;

  return (
    <>
      <PageHeader
        title="Auto Planner"
        subtitle="AI-proposed machine schedule over your Bayesian production rates. Review, then accept."
        actions={
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw className="h-4 w-4" /> Regenerate
          </Button>
        }
      />

      {/* The plan the floor is actually following, in full. */}
      {latest.data?.plan && <AcceptedPlanPanel plan={latest.data.plan} />}

      <LearnedWeightsPanel />

      {/* Horizon selector */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-ink-100 p-1 w-fit">
        {HORIZONS.map((d) => (
          <button
            key={d}
            onClick={() => setHorizon(d)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium",
              horizon === d ? "bg-surface shadow-sm text-ink-900" : "text-ink-600"
            )}
          >
            {d}-day horizon
          </button>
        ))}
      </div>

      {/*
        The horizon used to be a control wired to nothing — the server
        read it, echoed it back and planned the same lines whatever it
        said. Now that it really does select the work, say what it
        selected: `lines` counts only what the horizon admits, so a
        narrower one would otherwise look like work disappearing.
      */}
      {data?.horizonEnd && (
        <p className="mb-4 text-sm text-ink-400">
          Planning order lines due on or before{" "}
          <span className="font-medium text-ink-600">{data.horizonEnd}</span>
          {obj && obj.beyondHorizon > 0 && (
            <> · {obj.beyondHorizon} line{obj.beyondHorizon === 1 ? "" : "s"} due later, not planned</>
          )}
          . Overdue and undated lines are always included.
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <Card>
          <EmptyState title="Couldn't generate a plan" description="Try regenerating in a moment." />
        </Card>
      ) : data && obj ? (
        <>
          {/* Objective summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Lines placed" value={`${obj.placed}/${obj.lines}`} />
            <StatTile
              label="On time"
              value={obj.onTime}
              tone={obj.onTime === obj.placed ? "text-status-success" : undefined}
            />
            <StatTile
              label="Late"
              value={obj.late}
              tone={obj.late > 0 ? "text-status-danger" : "text-status-success"}
            />
            <StatTile label="Changeovers" value={obj.changeovers} />
          </div>

          {/*
            What the looms owe before any of this starts. The plan used
            to assume an idle plant and schedule on top of running jobs,
            so every start day was optimistic; now it queues behind them,
            and the reason a machine's first run does not begin today
            should be visible rather than inferred from the start days.
          */}
          {data.committed?.length > 0 && (
            <Card className="mb-4 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                Still running
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-600">
                {data.committed.map((c) => (
                  <li key={c.machineId} className="flex justify-between gap-4">
                    <span className="font-medium text-ink-900">{c.machineID}</span>
                    <span>
                      {c.committedWorkingDays} working day
                      {c.committedWorkingDays === 1 ? "" : "s"} left
                      {c.freeFrom && <> · free from {c.freeFrom}</>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Accept bar */}
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Wand2 className="h-4 w-4 text-brand-500" />
              <span>
                <span className="font-semibold">{obj.machinesUsed} machines</span> scheduled ·{" "}
                {obj.late > 0 ? (
                  <span className="text-status-danger">{obj.totalLateDays} late-days total</span>
                ) : (
                  <span className="text-status-success">all orders hit their supply date</span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {edited && (
                <>
                  <span className="text-xs text-status-warning">
                    You have changed this plan
                  </span>
                  <Button variant="secondary" onClick={() => setEdited(null)}>
                    Undo my changes
                  </Button>
                </>
              )}
              <Button onClick={() => onAccept(data)} loading={accept.isPending} disabled={obj.placed === 0}>
                <CheckCircle2 className="h-4 w-4" />
                {edited ? "Accept my version" : "Accept plan"}
              </Button>
            </div>
          </Card>

          {/* AI rationale */}
          {data.aiRationale && (
            <Card className="mb-4 border-l-4 border-brand-500 p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
                <Sparkles className="h-3.5 w-3.5" /> AI plan rationale
              </p>
              <p className="whitespace-pre-wrap text-sm text-ink-700">{data.aiRationale}</p>
            </Card>
          )}

          {/* Per-machine schedule */}
          {data.machines.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing to schedule"
                description="No pending order lines could be placed. Add approved orders or free up machines."
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {shown.map((mp) => (
                <MachineCard
                  key={mp.machineId}
                  mp={mp}
                  otherMachines={shown
                    .filter((o) => o.machineId !== mp.machineId)
                    .map((o) => ({ machineId: o.machineId, machineID: o.machineID }))}
                  onMove={moveLine}
                  onReorder={reorder}
                />
              ))}
            </div>
          )}

          {/* Unplaceable */}
          {data.unplaceable.length > 0 && (
            <Card className="mt-4 border-l-4 border-status-warning p-5">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-status-warning">
                <AlertTriangle className="h-4 w-4" /> Couldn't place ({data.unplaceable.length})
              </p>
              <ul className="divide-y divide-ink-100">
                {data.unplaceable.map((u, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{u.elasticName}</span>{" "}
                      <span className="text-ink-400">
                        · #{u.orderNo} {u.customer} · {u.qtyMeters.toLocaleString("en-IN")} m
                      </span>
                    </span>
                    <span className="text-xs text-ink-400">{u.reason}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Assumptions */}
          <div className="mt-4 flex items-start gap-2 text-xs text-ink-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <ul className="space-y-0.5">
              {data.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-1">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" /> {a}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
