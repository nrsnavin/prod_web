import { useMemo, useState } from "react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useJobMutations } from "./hooks";
import { JobDetail } from "./types";

/** A running job: the figures move, the lines do not, and nothing made is touched. */
export const RUNNING = ["weaving", "finishing", "checking"];
export const isRunning = (job: Pick<JobDetail, "status">) => RUNNING.includes(job.status);

/**
 * May this job's planned quantities still be changed?
 *
 * While preparatory, only while nothing has been committed to them:
 * past that point yarn has been drawn against these figures and a beam
 * may be on the rack. Once the job is running, each line can be set to
 * no less than what was woven — the beam came up short, or the loom was
 * set for a rounder number — until the job reaches packing.
 *
 * The server holds the same rule and refuses regardless — this is here
 * so the button is not offered and then taken away, and so the reason
 * can be shown next to it. It is deliberately the STRICTER of the two
 * where the client cannot see everything: warping batches are not on
 * the job detail payload, so a job that passes this check can still be
 * refused, and the refusal is shown as it comes back.
 */
export function editableReason(job: JobDetail): string | null {
  if (isRunning(job)) return null;
  if (job.status !== "preparatory") {
    return `Quantities can be changed until the job reaches packing (it is ${job.status}).`;
  }
  if (job.warping && job.warping.status !== "open") {
    return `Warping has started (${job.warping.status}) — the yarn is committed.`;
  }
  if (job.covering && job.covering.status !== "open") {
    return `Covering has started (${job.covering.status}) — the yarn is committed.`;
  }
  return null;
}

export function canEditElastics(job: JobDetail): boolean {
  return editableReason(job) === null;
}

type Line = { elasticId: string; elasticName: string; quantity: string; frozen: boolean; min: number };

export function JobElasticsEditModal({
  job,
  open,
  onClose,
}: {
  job: JobDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { updateElastics } = useJobMutations();
  // The job's version when the form opened, not at save time: a refetch
  // while the form is open must not hand the save a newer version.
  const [openedVersion] = useState(job.__v);
  // Set from the server's 409 JOB_EXCESS_WOULD_CHANGE — a refusal with a
  // reason worth reading, not a toast that scrolls away.
  const [refusal, setRefusal] = useState<string | null>(null);

  const running = isRunning(job);
  const madeOf = (id: string | null) =>
    Math.max(
      job.producedElastics.find((p) => p.elasticId === id)?.quantity ?? 0,
      job.packedElastics.find((p) => p.elasticId === id)?.quantity ?? 0
    );
  const original = useMemo<Line[]>(
    () =>
      (job.plannedElastics ?? []).map((e) => ({
        elasticId: e.elasticId ?? "",
        elasticName: e.elasticName,
        quantity: String(e.quantity ?? ""),
        frozen: !!e.frozen,
        // Running: no less than what was woven or packed of it.
        min: running ? madeOf(e.elasticId) : 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job.plannedElastics, job.producedElastics, job.packedElastics, running]
  );
  const [lines, setLines] = useState<Line[]>(original);
  const [auditReason, setAuditReason] = useState("");

  // The lines themselves are fixed: which elastics a job makes is set
  // when it is raised, from the order. This form changes HOW MUCH, and
  // adding a product here would have to draw its yarn, which is what
  // raising a job is for.
  const setQty = (i: number, quantity: string) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, quantity } : l)));

  const changed = original.some(
    (o, i) => Number(o.quantity) !== Number(lines[i]?.quantity)
  );
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  const save = () => {
    setRefusal(null);
    if (auditReason.trim().length < 3) {
      toast("Give a reason (min 3 chars) for the edit", "error");
      return;
    }
    if (!changed) {
      toast("Nothing has changed", "error");
      return;
    }
    if (lines.some((l) => !(Number(l.quantity) > 0))) {
      toast("Every quantity must be greater than 0", "error");
      return;
    }
    const below = lines.find((l) => Number(l.quantity) < l.min);
    if (below) {
      toast(`${below.elasticName}: ${below.min.toLocaleString("en-IN")} m is already woven or packed; the plan cannot be below that`, "error");
      return;
    }

    updateElastics.mutate(
      {
        jobId: job.id,
        elastics: lines.map((l) => ({
          elastic: l.elasticId,
          quantity: Number(l.quantity),
        })),
        auditReason: auditReason.trim(),
        // As it was when this form opened (the modal mounts per edit).
        expectedVersion: openedVersion,
      },
      {
        onSuccess: (res) => {
          // The server's own sentence, not a hardcoded one. When a
          // replan drops the requirement below what was already set
          // aside it trims the surplus and names the materials — and a
          // toast that always says the same thing would throw exactly
          // that away.
          toast(
            res?.message || "Job quantities updated — material requirement recalculated",
            "success"
          );
          onClose();
        },
        onError: (e) => {
          if (
            e instanceof ApiError &&
            (e.code === "JOB_EXCESS_WOULD_CHANGE" || e.code === "JOB_PREPARATION_STARTED")
          ) {
            setRefusal(e.message);
            return;
          }
          toast(e instanceof ApiError ? e.message : "Update failed", "error");
        },
      }
    );
  };

  return (
    <FormScreen open={open} onClose={onClose} title={`Edit ${job.jobNo} quantities`} width="max-w-xl">
      <div className="space-y-4">
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          {running
            ? "The job is running: each line can be set to no less than what was woven. Nothing made is touched; the order's pending quantity and material requirement follow. To bring an elastic in or close one out, use Change elastic."
            : "The warping order, the covering plan, the order's pending quantity and its material requirement are all recalculated from these figures."}
        </p>

        {refusal && (
          <p className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
            {refusal}
          </p>
        )}

        <div>
          <div className="hidden grid-cols-[1fr_120px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
            <span>Elastic</span>
            <span className="text-right">Planned qty (m)</span>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={l.elasticId || i} className="grid grid-cols-[1fr_120px] items-center gap-2">
                <span className="truncate text-sm text-ink-900">
                  {l.elasticName}
                  {l.frozen && <span className="ml-1.5 text-xs text-ink-400">frozen</span>}
                  {!l.frozen && l.min > 0 && (
                    <span className="block text-xs text-ink-400 tabular-nums">at least {l.min.toLocaleString("en-IN")} m made</span>
                  )}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min={l.min || undefined}
                  aria-label={`Planned quantity for ${l.elasticName}`}
                  value={l.quantity}
                  disabled={l.frozen}
                  onChange={(e) => setQty(i, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-right text-sm text-ink-600">
            Total <span className="font-semibold tabular-nums text-ink-900">{total.toLocaleString("en-IN")}</span> m
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason for edit *</label>
          <textarea
            aria-label="Reason for this change"
            rows={2}
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            placeholder="Why is this being changed? (recorded in the audit log)"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={updateElastics.isPending} onClick={save}>
            Save quantities
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}
