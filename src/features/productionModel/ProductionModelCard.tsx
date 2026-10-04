import { useState } from "react";
import { Gauge } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";
import { formatDate } from "@/core/format/date";
import { Evaluation, cleanRunTime, hoursMinutes, metres, useMachineExpectation } from "./api";

// ══════════════════════════════════════════════════════════════════
//  EXPECTED PRODUCTION, on the machine page
//
//  What the model has learned about this loom (its speed against the
//  plant's typical loom, how much its shifts scatter), a calculator for
//  "what will it make in this run time" at the pick of the elastics on
//  its heads (from their Elastic records), and how accurate
//  the model was on recent shifts it hadn't seen, beside simpler ways of
//  guessing, so nobody has to take it on trust.
// ══════════════════════════════════════════════════════════════════

const METHOD_LABELS: Record<keyof Evaluation["methods"], string> = {
  model: "This model",
  plantPhysics: "Plant speed × run time ÷ pick",
  machinePerHour: "Machine's metres per hour",
  machineAverage: "Machine's average per shift",
};

function speedSentence(index: number): string {
  const pct = Math.round((index - 1) * 100);
  if (Math.abs(pct) < 2) return "about as fast as the plant's typical loom";
  return `${Math.abs(pct)}% ${pct > 0 ? "faster" : "slower"} than the plant's typical loom`;
}

export function ProductionModelCard({ machineId }: { machineId: string }) {
  const [runTime, setRunTime] = useState("12:00");
  const askRunTime = useDebouncedValue(cleanRunTime(runTime), 300);
  const { data, isLoading, isError } = useMachineExpectation(machineId, askRunTime || undefined);

  if (isLoading) return <Skeleton className="mt-4 h-56 w-full" />;
  if (isError || !data) return null;

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <Gauge className="h-4 w-4 text-brand-600" aria-hidden />
      <h3 className="font-semibold">Expected production</h3>
      {data.summary && (
        <StatusChip tone={data.summary.basis === "machine" ? "success" : "neutral"}>
          {data.summary.basis === "machine" ? `Learned from ${data.summary.shifts} shifts` : "No history yet: plant average"}
        </StatusChip>
      )}
    </div>
  );

  if (!data.available || !data.summary) {
    return (
      <Card className="mt-4 space-y-2 p-5">
        {header}
        <p className="text-sm text-ink-500">{data.reason ?? "The model isn't trained yet."}</p>
      </Card>
    );
  }

  const s = data.summary;
  const p = data.prediction;
  const runTimeBad = runTime.trim() !== "" && !cleanRunTime(runTime);
  // The pick is the running elastics' own, from their records: every
  // head runs on the same pick, so there is nothing to type.
  const running = data.elastics.length
    ? data.elastics.map((e) => `${e.name ?? "Unnamed elastic"} on ${e.heads} head${e.heads === 1 ? "" : "s"}`).join(", ")
    : null;
  const pickNote: Record<NonNullable<typeof data.pickProblem>, string> = {
    "no-elastics": "No elastic is threaded on this loom's heads, so there is no pick to predict from.",
    "no-pick": "An elastic on this loom has no pick in its record. Add the pick to the elastic to see a prediction.",
    mixed: `The elastics on the heads have different picks in their records (${data.elastics
      .map((e) => `${e.name ?? "Unnamed"}: ${e.pick ?? "none"}`)
      .join(", ")}). Every head runs on one pick, so one of these records needs correcting.`,
  };

  return (
    <Card className="mt-4 space-y-4 p-5">
      {header}

      <p className="text-sm text-ink-600">
        {s.basis === "machine" ? (
          <>
            {data.machine.code} runs {speedSentence(s.speedIndex)}. Its shifts usually land within ±{s.scatterPct}% of what is expected.
          </>
        ) : (
          <>{data.machine.code} has no verified shifts yet, so this uses the plant's typical loom, with a wider range.</>
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Run time"
          inputMode="decimal"
          placeholder="12:00"
          value={runTime}
          onChange={(e) => setRunTime(e.target.value)}
          error={runTimeBad ? "Write it like 7:30" : undefined}
          hint={runTime.trim() === "" ? "Empty means a full 12-hour shift" : undefined}
        />
        <div className="space-y-1.5" data-testid="running-pick">
          <p className="text-sm font-medium text-ink-600">Pick</p>
          <p className="flex h-10 items-center text-sm font-semibold tabular-nums text-ink-900">{data.pick ?? "—"}</p>
          <p className="text-xs text-ink-400">{running ? `From the elastic record: ${running}` : "No elastic on the heads"}</p>
        </div>
      </div>

      {data.pickProblem && (
        <p role="status" className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          {pickNote[data.pickProblem]}
        </p>
      )}

      {p ? (
        <div className="rounded-xl bg-ink-100/60 p-4" aria-live="polite">
          <p className="text-sm text-ink-500">
            In {hoursMinutes(p.minutes)} at pick {p.pick}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-ink-900">{metres(p.total)}</p>
          <p className="text-sm text-ink-600">
            for the machine ({p.heads} head{p.heads === 1 ? "" : "s"}): {metres(p.perHead)} per head, likely{" "}
            <span className="tabular-nums">{metres(p.low)}–{metres(p.high)}</span>
          </p>
          {s.metresPerHeadHour != null && (
            <p className="mt-1 text-xs text-ink-400">
              {metres(s.metresPerHeadHour)} per head per hour at pick {s.pick}
            </p>
          )}
        </div>
      ) : null}

      {data.evaluation && <Accuracy evaluation={data.evaluation} />}
    </Card>
  );
}

function Accuracy({ evaluation: e }: { evaluation: Evaluation }) {
  const m = e.methods;
  const nextBest = Math.min(m.machineAverage.medianErrorPct, m.machinePerHour.medianErrorPct, m.plantPhysics.medianErrorPct);
  return (
    <details className="group rounded-lg border border-ink-200 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none font-medium text-ink-700">
        How accurate is this?{" "}
        <span className="font-normal text-ink-500">
          Typically off by {m.model.medianErrorPct}% on recent shifts
        </span>
      </summary>
      <div className="mt-2 space-y-2 text-ink-600">
        <p>
          Trained on {e.trainedOn} verified shifts, then tested on the {e.testedOn} after them ({formatDate(e.testFrom)} to{" "}
          {formatDate(e.testTo)}), which it hadn't seen. {m.model.within10Pct}% of those came within 10% of its prediction, and{" "}
          {m.model.rangeCoveragePct}% fell inside the likely range (8 in 10 should).
          {m.model.medianErrorPct > nextBest && " On this plant's data a simpler guess did better; treat these figures as rough."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-ink-400">
              <tr>
                <th className="py-1 pr-3 font-medium">Way of guessing</th>
                <th className="py-1 pr-3 text-right font-medium">Typical error</th>
                <th className="py-1 pr-3 text-right font-medium">Average miss</th>
                <th className="py-1 text-right font-medium">Within 10%</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(Object.keys(METHOD_LABELS) as Array<keyof Evaluation["methods"]>).map((k) => (
                <tr key={k} className={k === "model" ? "font-semibold text-ink-900" : undefined}>
                  <td className="py-1 pr-3">{METHOD_LABELS[k]}</td>
                  <td className="py-1 pr-3 text-right">{m[k].medianErrorPct}%</td>
                  <td className="py-1 pr-3 text-right">{metres(m[k].mae)}</td>
                  <td className="py-1 text-right">{m[k].within10Pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-400">Errors are per head per shift. Retrained from verified shifts every 15 minutes.</p>
      </div>
    </details>
  );
}
