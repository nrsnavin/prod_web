import { useMemo, useRef, useState } from "react";
import { Camera, ClipboardCheck, ClipboardList, Keyboard, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/core/http/httpClient";
import { floorService } from "./floorClient";
import { listOrder, readCode } from "./floorRules";
import { LoomRow } from "./LoomCard";
import { QrScanner } from "./QrScanner";
import { qrFromPhoto } from "./photoQr";
import type { CompleteResult, FloorMachine, FloorState } from "./types";

// ══════════════════════════════════════════════════════════════════
//  STEP 3 — SCAN THE LOOM
//
//  The camera reads the label; the loom's ID can be typed; or the loom
//  is tapped in the list, which also shows how far the shift has got.
//  All three end in the same place: the entry screen for that loom.
//  A shift nobody planned is scanned the same way: the looms entered
//  are noted as a draft the office can see, and Create shift plan —
//  pressed when every machine's production is in — makes them the plan.
// ══════════════════════════════════════════════════════════════════

export function ScanStep({ state, onMachine, onRefresh, onAuthLost, onCompleted, refreshing }: {
  state: FloorState;
  /** `photo`: the one photo of the label and the timer, to read the run time from. */
  onMachine: (m: FloorMachine, photo?: File) => void;
  onRefresh: () => void;
  onAuthLost: () => void;
  /** Create shift plan went through. */
  onCompleted: (r: CompleteResult) => void;
  refreshing?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Looms still to enter, when the server held the plan back for them.
  const [stillToEnter, setStillToEnter] = useState<{ id: string; ID: string }[] | null>(null);

  // A draft from the floor, not yet made the plan.
  const draft = !!state.plan?.fromFloor && !state.plan.floor;

  const create = async (force: boolean) => {
    setError(null);
    setCreating(true);
    try {
      const r = await floorService.complete(force);
      setStillToEnter(null);
      onCompleted(r);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { onAuthLost(); return; }
      if (err instanceof ApiError && err.code === "FLOOR_LOOMS_TO_ENTER") {
        setStillToEnter((err.data?.details as { looms?: { id: string; ID: string }[] } | undefined)?.looms ?? []);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not create the shift plan — try again.");
    } finally {
      setCreating(false);
    }
  };

  const sorted = useMemo(() => [...state.machines].sort(listOrder), [state.machines]);
  const toEnter = state.counts.toEnter;
  const done = state.counts.entered;
  const total = toEnter + done;

  const find = async (raw: string, photo?: File) => {
    const read = readCode(raw);
    if ("problem" in read) { setError(read.problem); return; }
    setError(null);
    setLooking(true);
    try {
      onMachine(await floorService.machine(read.code), photo);
      setTyped("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { onAuthLost(); return; }
      setError(err instanceof ApiError ? err.message : "Could not look that loom up — try again.");
    } finally {
      setLooking(false);
    }
  };

  const both = useRef<HTMLInputElement>(null);
  const fromPhoto = async (file: File) => {
    setError(null);
    setLooking(true);
    const code = await qrFromPhoto(file);
    setLooking(false);
    if (!code) {
      setError("No loom label could be found in that photo. Take it again with the label and the timer both in the frame, or scan the label.");
      return;
    }
    await find(code, file);
  };

  return (
    <div className="space-y-4">
      {(!state.plan || draft) && (
        <p className="flex items-start gap-2 rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info" role="status">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {state.plan
              ? "No plan was made for this shift: what you enter is noted as a draft the office can see. Press Create shift plan when every machine's production is in."
              : "No plan for this shift yet. Scan a loom and choose who ran it — what you enter is noted as a draft, and Create shift plan makes it the plan."}
          </span>
        </p>
      )}
      {state.plan?.floor && (
        <p className="flex items-start gap-2 rounded-lg bg-status-successBg px-3 py-2 text-sm text-status-success" role="status">
          <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Shift plan created — the office confirms it.
            {state.plan.floor.freeMachines.length > 0
              ? ` ${state.plan.floor.freeMachines.length} loom${state.plan.floor.freeMachines.length === 1 ? " was" : "s were"} free: ${state.plan.floor.freeMachines.map((m) => m.ID).join(", ")}.`
              : " No loom was free."}
            {state.plan.floor.loadingMachines.length > 0 &&
              ` Being loaded: ${state.plan.floor.loadingMachines.map((m) => `${m.ID}${m.operatorName ? ` (${m.operatorName})` : ""}`).join(", ")}.`}
          </span>
        </p>
      )}
      <div className="rounded-xl border border-ink-200 bg-surface p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{done} of {total} entered</span>
          <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900" disabled={refreshing}>
            <RefreshCw className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden /> Refresh
          </button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Looms entered">
          <div className="h-full rounded-full bg-status-success transition-[width]" style={{ width: total ? `${Math.round((done / total) * 100)}%` : "0%" }} />
        </div>
        {toEnter === 0 && total > 0 && <p className="mt-2 text-xs text-status-success">Every loom on this shift is entered.</p>}
      </div>

      {draft && (
        <div className="rounded-xl border border-ink-200 bg-surface p-3">
          <Button size="lg" className="w-full" onClick={() => void create(false)} loading={creating} disabled={done === 0}>
            <ClipboardCheck className="h-4 w-4" aria-hidden /> Create shift plan
          </Button>
          <p className="mt-2 text-center text-xs text-ink-500">
            Press when every machine's production is entered. The looms noted become the shift plan, for the office to confirm.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={stillToEnter !== null}
        title="Create the shift plan now?"
        message={`${stillToEnter?.length ?? 0} loom${(stillToEnter?.length ?? 0) === 1 ? " is" : "s are"} still to enter: ${(stillToEnter ?? []).map((m) => m.ID).join(", ")}. They stay on the shift to enter later.`}
        confirmLabel="Create anyway"
        loading={creating}
        onCancel={() => setStillToEnter(null)}
        onConfirm={() => void create(true)}
      />

      <QrScanner onCode={(code) => void find(code)} paused={looking} />

      {/* One photo for both: the label finds the loom, and the timer in
          the same photo is read for the run time on the next screen. */}
      <input
        ref={both}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Photo of the loom's label and timer"
        data-testid="label-and-timer-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void fromPhoto(file);
        }}
      />
      <Button variant="secondary" className="w-full" onClick={() => both.current?.click()} loading={looking}>
        <Camera className="h-4 w-4" aria-hidden /> One photo: the label and the timer together
      </Button>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); void find(typed); }}
      >
        <label className="flex-1">
          <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink-600"><Keyboard className="h-4 w-4" aria-hidden /> Or type the machine ID</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="e.g. L12"
            autoCapitalize="characters"
            autoCorrect="off"
            className="h-11 w-full rounded-lg border border-ink-200 bg-surface px-3 text-base uppercase placeholder:normal-case focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </label>
        <Button type="submit" size="md" className="h-11" loading={looking} disabled={!typed.trim()}>
          <Search className="h-4 w-4" aria-hidden /> Find
        </Button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-600">Or pick the loom</h3>
        <ul className="space-y-2">
          {sorted.map((m) => <LoomRow key={m.id} machine={m} onOpen={onMachine} />)}
        </ul>
      </div>
    </div>
  );
}
