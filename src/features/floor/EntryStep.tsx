import { useState } from "react";
import { ArrowLeft, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/core/http/httpClient";
import { TimerPhotoReader } from "@/features/shifts/TimerPhotoReader";
import { DEFAULT_CM_PER_MIN, perHeadText } from "@/features/shifts/productionRate";
import { floorService } from "./floorClient";
import { canEnter, tidyRunTime } from "./floorRules";
import { EntryChip, HeadMap } from "./LoomCard";
import type { FloorMachine, FloorState } from "./types";

// ══════════════════════════════════════════════════════════════════
//  STEP 4 — THE LOOM'S PRODUCTION
//
//  The loom's job and head map, the operator, the run time (typed, or
//  read off a photo of the display), the metres a head, a remark.
//  Saved as a SUBMISSION for the office to verify; until then it can be
//  corrected here.
//
//  A loom not on the shift yet goes on it the moment its operator is
//  chosen (the first one makes the plan, when nobody did), so the timer
//  photo taken next is kept with that entry for the office to see.
// ══════════════════════════════════════════════════════════════════

const timerService = {
  read: (photo: Blob, detailId?: string) => floorService.readTimerPhoto(photo, detailId),
  used: (photoId: string, runTime: string) => floorService.photoUsed(photoId, runTime),
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

export function EntryStep({ machine, state, onSaved, onBack, onAuthLost, onPlanMade }: {
  machine: FloorMachine;
  state: FloorState;
  onSaved: (m: FloorMachine) => void;
  onBack: () => void;
  onAuthLost: () => void;
  /** The shift had no plan; this loom just made it. */
  onPlanMade?: () => void;
}) {
  const prior = machine.detail?.submitted ?? null;
  const [operator, setOperator] = useState(machine.detail?.operator?.id ?? "");
  // The entry this loom has on the shift — from the plan, or made here
  // when the operator was chosen.
  const [detailId, setDetailId] = useState<string | null>(machine.detail?.id ?? null);
  const [placing, setPlacing] = useState(false);
  const [timer, setTimer] = useState(prior?.timer ?? "");
  const [production, setProduction] = useState(prior?.production != null ? String(prior.production) : "");
  // The metres the run time filled in last. While the field still shows
  // that, a new run time fills it again; once the supervisor has typed
  // their own figure, it is theirs and stays.
  const [filled, setFilled] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(prior?.feedback ?? "");

  const changeRunTime = (next: string) => {
    setTimer(next);
    const auto = perHeadText(next);
    if (auto && (production === "" || production === filled)) {
      setProduction(auto);
      setFilled(auto);
    }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On a loom not on the shift, the operator chosen puts it there at once.
  const chooseOperator = async (next: string) => {
    setOperator(next);
    if (detailId || !next) return;
    setError(null);
    setPlacing(true);
    try {
      const placed = await floorService.setOperator(machine.id, next);
      setDetailId(placed.detailId);
      if (placed.planCreated) onPlanMade?.();
    } catch (err) {
      setOperator("");
      if (err instanceof ApiError && err.status === 401) { onAuthLost(); return; }
      setError(err instanceof ApiError ? err.message : "Could not put this loom on the shift — try again.");
    } finally {
      setPlacing(false);
    }
  };

  const options = state.operators.map((o) => ({ value: o.id, label: o.department && o.department !== "weaving" ? `${o.name} (${o.department})` : o.name }));
  const metres = Number(production);
  const total = Number.isFinite(metres) && production !== "" ? metres * machine.headsRunning : null;
  const enterable = canEnter(machine) && !state.plan?.finalized;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!detailId || !operator) return setError("Choose who ran this loom — that puts it on the shift.");
    if (production === "" || !Number.isFinite(metres) || metres < 0) return setError("Enter the metres produced a head, 0 or more.");
    const runTime = tidyRunTime(timer);
    setBusy(true);
    try {
      const saved = await floorService.enter({
        detailId, production: metres, timer: runTime || null, feedback: feedback.trim(), operator: operator || null,
      });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { onAuthLost(); return; }
      setError(err instanceof ApiError ? err.message : "Could not save — check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to scanning
      </button>

      {/* The loom, as the label says it and as the office has it. */}
      <section className="rounded-xl border border-ink-200 bg-surface p-4" aria-label="Loom">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tabular-nums">{machine.ID}</h2>
            <p className="text-sm text-ink-500">
              {machine.manufacturer || "—"} · {machine.hooks ?? "?"} hooks · {machine.heads ?? "?"} heads
            </p>
          </div>
          <EntryChip entry={machine.entry} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-400">Job</dt>
          <dd className="font-medium">{machine.job ? `${machine.job.no} · ${machine.job.status}` : "none"}</dd>
          <dt className="text-ink-400">Heads running</dt>
          <dd className="font-medium tabular-nums">{machine.headsRunning} of {machine.heads ?? "?"}</dd>
        </dl>
        <HeadMap machine={machine} className="mt-3" />
      </section>

      {prior && (
        <p className="flex items-start gap-2 rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {machine.entry === "verified" ? "Verified" : "Entered"}
            {prior.production != null && `: ${prior.production} m/head`}
            {prior.timer && ` · ${prior.timer}`}
            {prior.byName && ` by ${prior.byName}`}
            {prior.at && ` at ${when(prior.at)}`}
            {machine.entry === "entered" && ". Saving again replaces it."}
          </span>
        </p>
      )}

      {!enterable ? (
        <div className="space-y-3 rounded-xl border border-ink-200 bg-surface-muted p-4 text-sm">
          <p className="font-medium">{state.plan?.finalized ? "This shift is finalised." : machine.why ?? "Nothing to enter on this loom."}</p>
          <Button variant="secondary" className="w-full" onClick={onBack}>Scan the next loom</Button>
        </div>
      ) : (
        <form onSubmit={save} noValidate className="space-y-4">
          <Select
            label={detailId ? "Operator" : "Operator — puts this loom on the shift"}
            value={operator}
            onChange={(e) => void chooseOperator(e.target.value)}
            options={options}
            placeholder="Choose…"
            disabled={placing}
          />

          <div className="space-y-2">
            <Input
              label="Run time"
              inputMode="decimal"
              placeholder="7:30 or 7.30"
              value={timer}
              onChange={(e) => changeRunTime(e.target.value)}
              onBlur={() => changeRunTime(tidyRunTime(timer))}
              hint={`Hours and minutes the loom ran this shift. Fills the metres a head at ${DEFAULT_CM_PER_MIN} cm a minute.`}
            />
            <TimerPhotoReader onUse={changeRunTime} shiftId={detailId ?? undefined} service={timerService} />
          </div>

          <Input
            label="Production per head (m)"
            type="number"
            step="0.01"
            min={0}
            value={production}
            onChange={(e) => setProduction(e.target.value)}
            hint={
              total != null
                ? `${production === filled ? `Filled from the run time at ${DEFAULT_CM_PER_MIN} cm/min — change it if the counter says otherwise. ` : ""}× ${machine.headsRunning} heads running = ${total.toLocaleString("en-IN")} m`
                : `Counted on the ${machine.headsRunning} heads running.`
            }
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-600">Remarks</span>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Beam change, breakdown, yarn short…"
              className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>

          {error && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>}

          <div className="sticky bottom-0 -mx-4 border-t border-ink-100 bg-canvas/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={placing}>
              <Check className="h-4 w-4" aria-hidden /> {machine.entry === "entered" ? "Save the correction" : "Save and scan next"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
