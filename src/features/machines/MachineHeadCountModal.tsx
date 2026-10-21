import { useState } from "react";
import { Minus, Plus, AlertTriangle } from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMachineMutations } from "./hooks";

// ══════════════════════════════════════════════════════════════════
//  CHANGING HOW MANY HEADS A LOOM HAS
//
//  Matches the worker app, which has had this since the head-count
//  sheet went digital — the same PATCH, the same rule.
//
//  ── What it is, and what it is not ──────────────────────────────
//  This is how many heads the loom HAS. How many a job RUNS is its head
//  plan (Change machine on the job, or Edit map below): a wide elastic
//  may run on 6 of 8. Production is counted by the plan, so this can
//  change while the loom is running — down to the heads the plan uses,
//  and no lower; the server says so if it would be.
//
//  ── The refusal is shown where it happened ───────────────────────
//  If the machine starts running between opening this and saving it,
//  the server refuses and names the status. That message is rendered
//  INLINE and stays until it is dealt with, rather than going to a
//  toast that deletes itself after three and a half seconds — a person
//  who looked away during the save would otherwise be left with a
//  dialog that appears to have worked.
// ══════════════════════════════════════════════════════════════════

/**
 * A loom with no heads cannot weave, and the server rejects anything
 * below one. The ceiling is not enforced server-side; it is here to
 * catch a stray keypress, because nothing in this plant has ninety-nine
 * heads and a typo that survives becomes a rate estimate nobody
 * believes.
 */
const MIN_HEADS = 1;
const MAX_HEADS = 64;

export function MachineHeadCountModal({
  machineId, machineID, current, onClose,
}: {
  machineId: string;
  machineID: string;
  current: number;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { updateHeads } = useMachineMutations();
  const [count, setCount] = useState<number>(current);
  const [error, setError] = useState<string | null>(null);

  const valid = Number.isInteger(count) && count >= MIN_HEADS && count <= MAX_HEADS;
  const changed = count !== current;

  // Shown as soon as the number goes out of range, not on a Save click.
  // Save is disabled while it is invalid, and a greyed button with no
  // stated reason is the silent refusal this app has too much of — the
  // user is left looking at a number they typed and a control that will
  // not respond.
  const rangeError =
    !valid && !Number.isNaN(count)
      ? `Enter a whole number between ${MIN_HEADS} and ${MAX_HEADS}.`
      : null;
  const shown = error ?? rangeError;

  const step = (by: number) => {
    setError(null);
    setCount((n) => Math.min(MAX_HEADS, Math.max(MIN_HEADS, (Number(n) || 0) + by)));
  };

  const save = () => {
    setError(null);
    if (!valid) return;
    updateHeads.mutate(
      { id: machineId, noOfHead: count },
      {
        onSuccess: () => {
          toast(`${machineID} now has ${count} head${count === 1 ? "" : "s"}`, "success");
          onClose();
        },
        // Inline, and it stays. The server's message names the status
        // that blocked it, which is the only useful thing to know.
        onError: (e) =>
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not change the head count. Try again."
          ),
      }
    );
  };

  return (
    <FormScreen open onClose={onClose} title={`Head count — ${machineID}`} width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          How many heads this loom has. To run a job on fewer of them, change the
          job&apos;s head plan instead — production is counted on the heads that run.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            aria-label="One fewer head"
            disabled={count <= MIN_HEADS}
            onClick={() => step(-1)}
          >
            <Minus className="h-4 w-4" />
          </Button>

          <label className="text-center">
            <span className="sr-only">Number of heads</span>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Number of heads"
              className="w-24 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-center text-2xl font-bold tabular-nums"
              value={Number.isFinite(count) ? count : ""}
              min={MIN_HEADS}
              max={MAX_HEADS}
              onChange={(e) => {
                setError(null);
                setCount(e.target.value === "" ? NaN : Number(e.target.value));
              }}
            />
          </label>

          <Button
            variant="secondary"
            aria-label="One more head"
            disabled={count >= MAX_HEADS}
            onClick={() => step(1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {changed && valid && (
          <p className="text-center text-sm text-ink-500 tabular-nums">
            {current} → <span className="font-medium text-ink-900">{count}</span>
          </p>
        )}

        {shown && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{shown}</span>
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={save}
            disabled={!valid || !changed || updateHeads.isPending}
            loading={updateHeads.isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}

export default MachineHeadCountModal;
