import { useMemo, useState } from "react";
import { Keyboard, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/core/http/httpClient";
import { floorService } from "./floorClient";
import { listOrder, readCode } from "./floorRules";
import { LoomRow } from "./LoomCard";
import { QrScanner } from "./QrScanner";
import type { FloorMachine, FloorState } from "./types";

// ══════════════════════════════════════════════════════════════════
//  STEP 3 — SCAN THE LOOM
//
//  The camera reads the label; the loom's ID can be typed; or the loom
//  is tapped in the list, which also shows how far the shift has got.
//  All three end in the same place: the entry screen for that loom.
// ══════════════════════════════════════════════════════════════════

export function ScanStep({ state, onMachine, onRefresh, onAuthLost, refreshing }: {
  state: FloorState;
  onMachine: (m: FloorMachine) => void;
  onRefresh: () => void;
  onAuthLost: () => void;
  refreshing?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...state.machines].sort(listOrder), [state.machines]);
  const toEnter = state.counts.toEnter;
  const done = state.counts.entered;
  const total = toEnter + done;

  const find = async (raw: string) => {
    const read = readCode(raw);
    if ("problem" in read) { setError(read.problem); return; }
    setError(null);
    setLooking(true);
    try {
      onMachine(await floorService.machine(read.code));
      setTyped("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { onAuthLost(); return; }
      setError(err instanceof ApiError ? err.message : "Could not look that loom up — try again.");
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="space-y-4">
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

      <QrScanner onCode={(code) => void find(code)} paused={looking} />

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
