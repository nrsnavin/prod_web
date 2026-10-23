import { useMemo, useState } from "react";
import { ClipboardList, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/core/http/httpClient";
import { floorService } from "./floorClient";
import { EntryChip } from "./LoomCard";
import type { FloorState } from "./types";

// ══════════════════════════════════════════════════════════════════
//  STEP 2 — WHO IS ON EACH LOOM, WHEN NOBODY MADE THE PLAN
//
//  Every loom with a job is listed; the supervisor puts an operator on
//  each and the plan is made from that — a draft, for the admin to
//  confirm. A loom being loaded is listed too (its operator is on the
//  shift even though it weaves nothing); a free loom is not.
//
//  A loom left without an operator is simply not on the plan; scanning
//  it later asks for the operator and adds it then.
// ══════════════════════════════════════════════════════════════════

export function SetupStep({ state, onPlanned, onPlanExists }: {
  state: FloorState;
  onPlanned: (next: FloorState) => void;
  /** A plan turned up meanwhile (someone made it in the office). */
  onPlanExists: () => void;
}) {
  const looms = useMemo(() => state.machines.filter((m) => m.job && m.status === "running"), [state.machines]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [fillWith, setFillWith] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = state.operators.map((o) => ({ value: o.id, label: o.department && o.department !== "weaving" ? `${o.name} (${o.department})` : o.name }));
  const rows = looms.filter((m) => picked[m.id]).map((m) => ({ machine: m.id, operator: picked[m.id] }));

  const fillEmpty = () => {
    if (!fillWith) return;
    setPicked((p) => {
      const next = { ...p };
      for (const m of looms) if (!next[m.id]) next[m.id] = fillWith;
      return next;
    });
  };

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      onPlanned(await floorService.createPlan(rows));
    } catch (err) {
      if (err instanceof ApiError && err.code === "PLAN_EXISTS") { onPlanExists(); return; }
      setError(err instanceof ApiError ? err.message : "Could not make the plan — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!looms.length) {
    return (
      <div className="rounded-xl border border-ink-200 bg-surface p-5 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-ink-300" aria-hidden />
        <p className="mt-2 font-semibold">No loom is running a job</p>
        <p className="mt-1 text-sm text-ink-500">Assign jobs to machines in the office first; there is nothing to enter on this shift yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Who is on each loom?</h2>
        <p className="mt-1 text-sm text-ink-500">
          This shift has no plan yet. Put an operator on each loom and the plan is made from it.
        </p>
      </div>

      <div className="flex items-end gap-2 rounded-xl bg-surface-muted p-3">
        <div className="flex-1">
          <Select label="Same operator on the empty rows" value={fillWith} onChange={(e) => setFillWith(e.target.value)} options={options} placeholder="Choose…" />
        </div>
        <Button type="button" variant="secondary" onClick={fillEmpty} disabled={!fillWith}>
          <Users className="h-4 w-4" aria-hidden /> Fill
        </Button>
      </div>

      <ul className="space-y-2">
        {looms.map((m) => (
          <li key={m.id} className="rounded-xl border border-ink-200 bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tabular-nums">{m.ID}</span>
              <span className="truncate text-sm text-ink-500">{m.job?.no} · {m.headsRunning} of {m.heads ?? "?"} heads</span>
              <span className="ml-auto">{m.loading ? <EntryChip entry="loading" /> : null}</span>
            </div>
            <div className="mt-2">
              <Select
                aria-label={`Operator on ${m.ID}`}
                value={picked[m.id] ?? ""}
                onChange={(e) => setPicked((p) => ({ ...p, [m.id]: e.target.value }))}
                options={options}
                placeholder="Nobody yet"
              />
            </div>
          </li>
        ))}
      </ul>

      {error && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>}

      <div className="sticky bottom-0 -mx-4 border-t border-ink-100 bg-canvas/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Button size="lg" className="w-full" onClick={create} loading={busy} disabled={!rows.length}>
          Create the plan{rows.length ? ` · ${rows.length} loom${rows.length === 1 ? "" : "s"}` : ""}
        </Button>
        {rows.length < looms.length && rows.length > 0 && (
          <p className="mt-2 text-center text-xs text-ink-400">Looms without an operator are left off; scanning one later asks who is on it.</p>
        )}
      </div>
    </div>
  );
}
