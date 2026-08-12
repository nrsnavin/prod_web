import { useMemo, useState } from "react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useJobMutations } from "./hooks";
import { JobDetail } from "./types";

/**
 * May this job's planned quantities still be changed?
 *
 * Only while nothing has been committed to them. Past that point yarn
 * has been drawn against these figures and a beam may be on the rack:
 * changing the numbers would leave the floor working to a sheet the
 * paperwork no longer shows.
 *
 * The server holds the same rule and refuses regardless — this is here
 * so the button is not offered and then taken away, and so the reason
 * can be shown next to it. It is deliberately the STRICTER of the two
 * where the client cannot see everything: warping batches are not on
 * the job detail payload, so a job that passes this check can still be
 * refused, and the refusal is shown as it comes back.
 */
export function editableReason(job: JobDetail): string | null {
  if (job.status !== "preparatory") {
    return `Quantities can only be changed while the job is preparatory (it is ${job.status}).`;
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

type Line = { elasticId: string; elasticName: string; quantity: string };

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
  // Set from the server's 409 JOB_EXCESS_WOULD_CHANGE — a refusal with a
  // reason worth reading, not a toast that scrolls away.
  const [refusal, setRefusal] = useState<string | null>(null);

  const original = useMemo<Line[]>(
    () =>
      (job.plannedElastics ?? []).map((e) => ({
        elasticId: e.elasticId ?? "",
        elasticName: e.elasticName,
        quantity: String(e.quantity ?? ""),
      })),
    [job.plannedElastics]
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

    updateElastics.mutate(
      {
        jobId: job.id,
        elastics: lines.map((l) => ({
          elastic: l.elasticId,
          quantity: Number(l.quantity),
        })),
        auditReason: auditReason.trim(),
      },
      {
        onSuccess: () => {
          toast("Job quantities updated — material requirement recalculated", "success");
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
          The warping order, the covering plan, the order&apos;s pending quantity
          and its material requirement are all recalculated from these figures.
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
                <span className="truncate text-sm text-ink-900">{l.elasticName}</span>
                <Input
                  type="number"
                  step="0.01"
                  aria-label={`Planned quantity for ${l.elasticName}`}
                  value={l.quantity}
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
