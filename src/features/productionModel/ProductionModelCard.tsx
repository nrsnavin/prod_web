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
//  "what will it make in this run time at this pick", and how accurate
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
  const [pick, setPick] = useState("");
  // Debounced as plain values: an object would be new on every render.
  const askRunTime = useDebouncedValue(cleanRunTime(runTime), 300);
  const askPick = useDebouncedValue(Number(pick) > 0 ? Number(pick) : undefined, 300);
  const { data, isLoading, isError } = useMachineExpectation(machineId, { runTime: askRunTime || undefined, pick: askPick });

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
  const headsPick = data.elastics.length
    ? data.elastics.map((e) => `${e.name ?? "Unnamed"} (pick ${e.pick ?? "?"}) on ${e.heads} head${e.heads === 1 ? "" : "s"}`).join(", ")
    : "No elastics on the heads";

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
        <Input
          label="Pick"
          type="number"
          min={1}
          step="any"
          placeholder={data.pickFrom === "heads" && data.pick ? String(data.pick) : "e.g. 14"}
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          hint={pick ? "Try another elastic's pick" : headsPick}
        />
      </div>

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
      ) : (
        <p className="text-sm text-ink-500">Enter a pick to see what it would make. This loom has no elastic with a pick on its heads.</p>
      )}

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
