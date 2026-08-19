import { useState } from "react";
import { AlertTriangle, ArrowRight, Lock } from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMachineMutations } from "./hooks";
import { MachineDetail, MachineDetailsPatch } from "./types";

// ══════════════════════════════════════════════════════════════════
//  CORRECTING A MACHINE'S DETAILS
//
//  Registration was the only chance to get these right. A typo in the
//  ID, the wrong manufacturer, hooks entered as 12 on a 24-hook loom —
//  all of them were permanent, because a machine anything references
//  cannot be deleted and registered again. They were simply lived with.
//
//  ── Why this asks before it saves ────────────────────────────────
//  Two of these fields decide things rather than describe them. Hooks
//  per head is what the fit check compares every elastic against; the
//  ID is what the loom is called on the floor and what the production
//  plan writes down. Getting one wrong here is not a typo you notice —
//  it is a machine that quietly stops being offered for products it can
//  actually run.
//
//  So saving is two steps. The second one is not a "are you sure?" with
//  no content — it lists every field that is about to change, old value
//  beside new, and nothing else. If it lists something you did not mean
//  to touch, that is the thing this screen exists to catch.
//
//  A change of nothing never reaches that step: Save stays inert until
//  something actually differs, and says so rather than sitting greyed
//  out with no explanation.
//
//  ── The rules are stated before the attempt, not after ───────────
//  ID and hook count can only change while the loom is FREE, because
//  both are read by work in progress. The server enforces it; this
//  screen agrees with it, disabling those two fields on a busy loom and
//  saying which status is blocking them. Letting somebody type a new ID
//  and then refusing it is a worse version of the same conversation.
// ══════════════════════════════════════════════════════════════════

/** Fields the server will only change while the machine is free. */
const LOCKED_UNLESS_FREE = ["ID", "NoOfHooks"] as const;

const MIN_HOOKS = 1;
const MAX_HOOKS = 200;

/** What each field is called in the confirmation, in a person's words. */
const FIELD_LABELS: Record<string, string> = {
  ID: "Machine ID",
  manufacturer: "Manufacturer",
  NoOfHooks: "Hooks per head",
  DateOfPurchase: "Purchased",
};

interface Draft {
  ID: string;
  manufacturer: string;
  NoOfHooks: string;
  DateOfPurchase: string;
}

/** The stored value of each editable field, as the form holds it. */
function draftFrom(machine: MachineDetail): Draft {
  return {
    ID: machine.id ?? "",
    manufacturer: machine.manufacturer ?? "",
    NoOfHooks: String(machine.hooks ?? ""),
    // <input type="date"> only accepts yyyy-mm-dd, and the stored value
    // may carry a time. Anything it cannot parse is left blank rather
    // than shown mangled.
    DateOfPurchase: (machine.dateOfPurchase ?? "").slice(0, 10),
  };
}

export function MachineEditModal({
  machineId,
  machine,
  onClose,
}: {
  machineId: string;
  machine: MachineDetail;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { updateDetails } = useMachineMutations();

  const original = draftFrom(machine);
  const [draft, setDraft] = useState<Draft>(original);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server comes back asking whether to strand an elastic
  // the loom is already threaded with. Holds its question verbatim.
  const [hookWarning, setHookWarning] = useState<string | null>(null);

  const isFree = machine.status === "free";
  const set = (k: keyof Draft, v: string) => {
    setError(null);
    setHookWarning(null);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // ── What is actually different ───────────────────────────────────
  // Computed from the stored values rather than tracked by an onChange
  // flag, so typing a character and deleting it is correctly no change.
  const hooks = Number(draft.NoOfHooks);
  const changes = (Object.keys(original) as (keyof Draft)[])
    .filter((k) => draft[k].trim() !== original[k].trim())
    // A locked field cannot have changed, but if the machine started
    // running while this was open it could be locked and dirty at once.
    .filter((k) => isFree || !(LOCKED_UNLESS_FREE as readonly string[]).includes(k))
    .map((k) => ({
      field: k,
      label: FIELD_LABELS[k] ?? k,
      from: original[k].trim(),
      to: draft[k].trim(),
    }));

  const idError =
    draft.ID.trim() === "" ? "The machine needs an ID." : null;
  const manufacturerError =
    draft.manufacturer.trim() === "" ? "Manufacturer cannot be empty." : null;
  const hooksError =
    draft.NoOfHooks.trim() === ""
      ? "Hooks per head is required."
      : !Number.isInteger(hooks) || hooks < MIN_HOOKS || hooks > MAX_HOOKS
        ? `Enter a whole number between ${MIN_HOOKS} and ${MAX_HOOKS}.`
        : null;

  const invalid = idError ?? manufacturerError ?? hooksError;
  const canReview = !invalid && changes.length > 0;

  /** Only the changed fields, in the shape the route takes. */
  const patch: MachineDetailsPatch = Object.fromEntries(
    changes.map((c) => [
      c.field,
      c.field === "NoOfHooks"
        ? Number(c.to)
        : c.field === "DateOfPurchase" && c.to === ""
          ? null
          : c.to,
    ])
  );

  const save = (confirmHooks = false) => {
    setError(null);
    updateDetails.mutate(
      { id: machineId, patch, confirmHooks },
      {
        onSuccess: () => {
          toast(
            changes.length === 1
              ? `${changes[0].label} updated`
              : `${changes.length} details updated`,
            "success"
          );
          onClose();
        },
        onError: (e) => {
          // A 409 naming the hook rule is a question, not a refusal —
          // shown as its own step with the server's sentence intact and
          // a control that answers it.
          if (e instanceof ApiError && e.code === "HOOKS_EXCEED_MACHINE") {
            setHookWarning(e.message);
            return;
          }
          setError(
            e instanceof ApiError ? e.message : "Could not save the changes. Try again."
          );
          // Back to the form: a refusal that leaves you staring at a
          // confirmation you cannot complete is a dead end.
          setConfirming(false);
        },
      }
    );
  };

  const lockNote = (
    <span className="mt-1 flex items-center gap-1 text-xs text-ink-400">
      <Lock className="h-3 w-3" />
      Locked while the loom is {machine.status}
    </span>
  );

  return (
    <FormScreen
      open
      onClose={onClose}
      title={`Edit machine — ${machine.id}`}
      width="max-w-lg"
    >
      {confirming ? (
        // ── Step two: exactly what is about to change ──────────────
        <div className="space-y-4">
          <p className="text-sm text-ink-500">
            {changes.length === 1
              ? "One detail will change:"
              : `${changes.length} details will change:`}
          </p>

          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {changes.map((c) => (
              <li key={c.field} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="w-32 shrink-0 text-ink-500">{c.label}</span>
                <span className="text-ink-400 line-through">{c.from || "—"}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                <span className="font-medium text-ink-900">{c.to || "—"}</span>
              </li>
            ))}
          </ul>

          {/* The two that are not just labels get their consequence
              spelled out, because "hooks: 24 → 12" does not read as
              "this machine will stop being offered for wide products". */}
          {changes.some((c) => c.field === "NoOfHooks") && (
            <p className="rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
              Hooks per head decides which elastics this machine can be
              assigned. Lowering it may make some products no longer fit.
            </p>
          )}
          {changes.some((c) => c.field === "ID") && (
            <p className="rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
              The machine ID is what this loom is called on the floor and on
              printed plans. Past production plans keep the old name.
            </p>
          )}

          {hookWarning && (
            <div
              role="alert"
              className="rounded-lg bg-status-warningBg px-3 py-2.5 text-sm text-status-warning"
            >
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{hookWarning}</span>
              </span>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => { setHookWarning(null); setConfirming(false); }}
              disabled={updateDetails.isPending}
            >
              {/* Not just "Back": the screen's own header already has a
                  Back control that closes the whole dialog. Two controls
                  with one word and two meanings is a trap. */}
              Back to editing
            </Button>
            <Button
              onClick={() => save(!!hookWarning)}
              loading={updateDetails.isPending}
              variant={hookWarning ? "danger" : "primary"}
            >
              {hookWarning ? "Change it anyway" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : (
        // ── Step one: the form ─────────────────────────────────────
        <div className="space-y-4">
          <div>
            <Input
              label="Machine ID"
              value={draft.ID}
              disabled={!isFree}
              error={idError ?? undefined}
              onChange={(e) => set("ID", e.target.value)}
            />
            {!isFree && lockNote}
          </div>

          <Input
            label="Manufacturer"
            value={draft.manufacturer}
            error={manufacturerError ?? undefined}
            onChange={(e) => set("manufacturer", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Hooks per head"
                type="number"
                inputMode="numeric"
                value={draft.NoOfHooks}
                disabled={!isFree}
                error={hooksError ?? undefined}
                onChange={(e) => set("NoOfHooks", e.target.value)}
              />
              {!isFree && lockNote}
            </div>
            <Input
              label="Purchased"
              type="date"
              value={draft.DateOfPurchase}
              onChange={(e) => set("DateOfPurchase", e.target.value)}
              hint="Leave blank if unknown"
            />
          </div>

          {/* Head count is edited on its own, and saying so here stops
              somebody hunting for a field that is deliberately absent. */}
          <p className="text-xs text-ink-400">
            Head count ({machine.heads}) is changed separately — it re-prices
            work in progress, so it has its own confirmation.
          </p>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            {/* Stated, not implied by a greyed button. */}
            {!invalid && changes.length === 0 && (
              <span className="text-sm text-ink-400">Nothing has changed yet</span>
            )}
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setConfirming(true)} disabled={!canReview}>
              Review changes
            </Button>
          </div>
        </div>
      )}
    </FormScreen>
  );
}

export default MachineEditModal;
