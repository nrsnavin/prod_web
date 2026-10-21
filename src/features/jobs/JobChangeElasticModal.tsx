import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useJobMutations, useJobOrderElastics } from "./hooks";
import { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  CHANGING THE ELASTIC ON A RUNNING JOB — the exceptional case
//
//  The beam came up short, or the loom cannot hold the product: the
//  floor goes on to another elastic of the same order without stopping
//  the job. This is that one move, with a reason:
//
//    • the elastic coming in must be on the order, and no more of it
//      than the order still has unplanned;
//    • the line it replaces is FROZEN at what was woven — kept on the
//      job, counted no further, its shortfall back on the order;
//    • the loom's heads follow, so production counts for the new
//      elastic from the next verified shift.
// ══════════════════════════════════════════════════════════════════

const MIN_REASON = 8;
type Heads = "frozen" | "all" | "none";

export function JobChangeElasticModal({ job, open, onClose }: { job: JobDetail; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { changeElastic } = useJobMutations();
  const candidates = useJobOrderElastics(job.id, open);
  const [openedVersion] = useState(job.__v);

  const [elasticId, setElasticId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [heads, setHeads] = useState<Heads>("frozen");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [hookClash, setHookClash] = useState<{ machineName: string; machineHooks: number; elastics: Array<{ name: string; noOfHook: number }> } | null>(null);

  // The lines still live on the job; the one the loom is on is the
  // usual thing to freeze, so a single live line starts ticked.
  const liveLines = useMemo(() => job.plannedElastics.filter((e) => e.elasticId && !e.frozen), [job.plannedElastics]);
  const [freeze, setFreeze] = useState<Set<string>>(
    () => new Set(liveLines.length === 1 ? [liveLines[0].elasticId as string] : [])
  );

  const options = useMemo(
    () => (candidates.data?.elastics ?? []).filter((c) => !c.onJob),
    [candidates.data]
  );
  const chosen = options.find((o) => o.elasticId === elasticId);
  // Picking an elastic starts from everything the order still has
  // unplanned of it; the figure is then the person's to change.
  const pick = (id: string) => {
    setElasticId(id);
    const c = options.find((o) => o.elasticId === id);
    setQuantity(c ? String(c.pending) : "");
  };

  const qty = Number(quantity);
  const problem =
    !elasticId ? "Choose the elastic to put on"
      : !(qty > 0) ? "Quantity must be greater than 0"
        : chosen && qty > chosen.pending ? `The order has only ${chosen.pending.toLocaleString("en-IN")} m of it not yet planned`
          : reason.trim().length < MIN_REASON ? `Give the reason (at least ${MIN_REASON} characters)`
            : null;

  const submit = (confirmHooks = false) => {
    setRefusal(null);
    changeElastic.mutate(
      {
        jobId: job.id,
        body: {
          elastic: elasticId, quantity: qty, auditReason: reason.trim(),
          freeze: [...freeze], heads, confirmHooks, expectedVersion: openedVersion,
        },
      },
      {
        onSuccess: (res) => {
          setHookClash(null);
          toast(res.message, "success");
          onClose();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === "HOOKS_EXCEED_MACHINE") {
            const d = (e.data?.details ?? {}) as { machineName?: string; machineHooks?: number; elastics?: Array<{ name: string; noOfHook: number }> };
            setHookClash({ machineName: d.machineName ?? "This machine", machineHooks: d.machineHooks ?? 0, elastics: d.elastics ?? [] });
            return;
          }
          if (e instanceof ApiError && (e.status === 409 || e.code === "JOB_ELASTIC_OVER_ORDER")) {
            setRefusal(e.message);
            return;
          }
          toast(e instanceof ApiError ? e.message : "Could not change the elastic", "error");
        },
      }
    );
  };

  const toggleFreeze = (id: string, on: boolean) =>
    setFreeze((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  return (
    <FormScreen open={open} onClose={onClose} title={`Change elastic mid-run — ${job.jobNo}`} width="max-w-xl">
      <div className="space-y-4 text-sm">
        <p className="flex items-start gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-xs text-status-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            For exceptional cases only, such as a beam that cannot reach its metres. The elastic
            leaving is kept on the job, frozen at what was woven; its shortfall goes back to the
            order. The one coming in must be on the order. Recorded with your reason.
          </span>
        </p>

        {refusal && (
          <p className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{refusal}</p>
        )}

        <Select
          label="Elastic to put on *"
          value={elasticId}
          onChange={(e) => pick(e.target.value)}
          placeholder={candidates.isLoading ? "Loading the order…" : options.length ? "Choose from the order" : "Every elastic of the order is on this job already"}
          disabled={!options.length}
          options={options.map((o) => ({
            value: o.elasticId,
            label: `${o.elasticName} · ${o.pending.toLocaleString("en-IN")} m not yet planned of ${o.ordered.toLocaleString("en-IN")}`,
          }))}
        />

        <Input
          label="Quantity to plan (m) *"
          type="number"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={!chosen}
          error={chosen && qty > chosen.pending ? `At most ${chosen.pending.toLocaleString("en-IN")} m` : undefined}
        />

        {liveLines.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-600">Freeze at what was woven</legend>
            <div className="space-y-1.5">
              {liveLines.map((l) => {
                const produced = job.producedElastics.find((p) => p.elasticId === l.elasticId)?.quantity ?? 0;
                return (
                  <label key={l.elasticId!} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={freeze.has(l.elasticId!)}
                      onChange={(e) => toggleFreeze(l.elasticId!, e.target.checked)}
                      aria-label={`Freeze ${l.elasticName}`}
                    />
                    <span>
                      <span className="font-medium">{l.elasticName}</span>
                      <span className="block text-xs text-ink-400 tabular-nums">
                        planned {l.quantity.toLocaleString("en-IN")} m · woven {produced.toLocaleString("en-IN")} m
                        {freeze.has(l.elasticId!) && ` → frozen at ${produced.toLocaleString("en-IN")} m, ${Math.max(0, l.quantity - produced).toLocaleString("en-IN")} m back to the order`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {job.machine && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-600">On {job.machine.machineName}</legend>
            <div className="space-y-1">
              {([
                ["frozen", "Put it on the heads the frozen elastic is on"],
                ["all", "Put it on every running head"],
                ["none", "Leave the head map; I'll set it on the machine"],
              ] as Array<[Heads, string]>).map(([v, label]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="heads" value={v} checked={heads === v} onChange={() => setHeads(v)} className="h-4 w-4" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason *</label>
          <textarea
            aria-label="Reason for the change"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Beam programmed for 5,000 m came up 1,800 m short"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {problem && elasticId && <span className="text-xs text-status-danger">{problem}</span>}
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={changeElastic.isPending} disabled={!!problem} onClick={() => submit(false)}>
            Change elastic
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!hookClash}
        title="This machine has too few hooks"
        message={
          hookClash
            ? `${hookClash.machineName} has ${hookClash.machineHooks} hooks per head. ` +
              `${hookClash.elastics.map((e) => `${e.name} needs ${e.noOfHook}`).join("; ")}. ` +
              `It cannot be woven as specified on this machine. Change anyway?`
            : ""
        }
        confirmLabel="Change anyway"
        danger
        loading={changeElastic.isPending}
        onCancel={() => setHookClash(null)}
        onConfirm={() => submit(true)}
      />
    </FormScreen>
  );
}
