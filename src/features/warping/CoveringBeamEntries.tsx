import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useCoveringMutations } from "./hooks";
import { BeamEntry, Covering } from "./types";

function enteredByName(by: BeamEntry["enteredBy"]): string | null {
  if (by && typeof by === "object") return by.name ?? null;
  return null;
}

function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Beam weight log for a covering: add a beam (number + kg) and list the
// recorded entries. Mirrors the Flutter covering beam-entry flow. Editing
// is locked once the covering is completed/cancelled (backend enforces it
// too).
export function CoveringBeamEntries({ covering }: { covering: Covering }) {
  const { toast } = useToast();
  const { addBeam, deleteBeam } = useCoveringMutations();
  const [beamNo, setBeamNo] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  const entries = covering.beamEntries ?? [];
  const editable = covering.status === "open" || covering.status === "in_progress";
  const total = covering.producedWeight ?? entries.reduce((s, e) => s + (e.weight || 0), 0);

  const submit = () => {
    const no = parseInt(beamNo, 10);
    const w = parseFloat(weight);
    if (!Number.isFinite(no) || no <= 0) { toast("Enter a valid beam number", "error"); return; }
    if (!Number.isFinite(w) || w <= 0) { toast("Enter a valid weight (kg)", "error"); return; }
    addBeam.mutate(
      { id: covering._id, beamNo: no, weight: w, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setBeamNo("");
          setWeight("");
          setNote("");
          toast("Beam entry added", "success");
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to add beam entry", "error"),
      }
    );
  };

  const remove = (entry: BeamEntry) =>
    deleteBeam.mutate(
      { coveringId: covering._id, entryId: entry._id },
      {
        onSuccess: () => toast("Beam entry removed", "success"),
        onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to remove beam entry", "error"),
      }
    );

  return (
    <Card className="mt-4 p-5 max-w-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Beam entries</h3>
        <span className="text-sm text-ink-600">
          Total: <span className="font-semibold tabular-nums">{fmtKg(total)} kg</span>
          {entries.length > 0 && ` · ${entries.length} beam${entries.length > 1 ? "s" : ""}`}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">No beams recorded yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {entries.map((e) => {
            const by = enteredByName(e.enteredBy);
            return (
              <li key={e._id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">Beam {e.beamNo}</span>
                  <span className="tabular-nums"> · {fmtKg(e.weight)} kg</span>
                  {e.note && <span className="text-ink-400"> · {e.note}</span>}
                  <div className="text-xs text-ink-400">
                    {e.enteredAt ? new Date(e.enteredAt).toLocaleDateString() : ""}
                    {by ? ` · by ${by}` : ""}
                  </div>
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={() => remove(e)}
                    disabled={deleteBeam.isPending}
                    className="p-1 rounded text-ink-400 hover:text-status-danger disabled:opacity-40"
                    aria-label={`Remove beam ${e.beamNo}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <div className="grid grid-cols-[90px_110px_1fr] gap-2 items-end">
            <Input
              label="Beam #"
              type="number"
              value={beamNo}
              onChange={(e) => setBeamNo(e.target.value)}
              placeholder="1"
            />
            <Input
              label="Weight (kg)"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. shade B"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" loading={addBeam.isPending} onClick={submit}>
              <Plus className="h-4 w-4" /> Add beam
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
