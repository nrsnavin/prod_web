import { useState } from "react";
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

function MachineCard({ mp }: { mp: MachinePlan }) {
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
          <SequenceRow key={i} row={r} />
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

  const onAccept = (plan: SuggestedPlan) => {
    accept.mutate(plan, {
      onSuccess: () => {
        toast("Plan accepted as the plan of record", "success");
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

      {/* Plan of record banner */}
      {latest.data?.plan && (
        <Card className="mb-4 flex items-center gap-2 border-l-4 border-status-success p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
          <span>
            Plan of record accepted{" "}
            <span className="font-medium">
              {new Date(latest.data.plan.acceptedAt).toLocaleString("en-IN")}
            </span>{" "}
            by {latest.data.plan.acceptedBy || "admin"} · {latest.data.plan.assignments.length} assignments
          </span>
        </Card>
      )}

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
            <Button onClick={() => onAccept(data)} loading={accept.isPending} disabled={obj.placed === 0}>
              <CheckCircle2 className="h-4 w-4" /> Accept plan
            </Button>
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
              {data.machines.map((mp) => (
                <MachineCard key={mp.machineId} mp={mp} />
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
