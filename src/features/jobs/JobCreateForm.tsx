import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { OrderDetail } from "@/features/orders/types";
import { useJobMutations } from "./hooks";

// Creates a job from an order: pick quantities per elastic.
//
// A line may be planned up to 20% past what the order ASKED FOR with no
// comment — a loom is set for a round number of meters, and checking
// rejects some of what comes off it. Past 20% the planner is asked why,
// and the reason is kept on the order.
//
// Excess is not free: the order's approval drew yarn for the ordered
// quantity only, so the server draws the difference at this point and
// refuses the job if the stock is not there. The warnings below say so
// before the button is pressed.

/** Mirrors FREE_EXCESS_PCT in services/excessPlanning.js. */
export const FREE_EXCESS_PCT = 20;
/** Mirrors MIN_REASON_LENGTH there. */
const MIN_REASON = 8;

const fmt = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("en-IN");

export function JobCreateForm({
  order,
  onClose,
  onCreated,
}: {
  order: OrderDetail;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}) {
  const { toast } = useToast();
  const { create } = useJobMutations();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  // Every ordered line, not only the ones with something unassigned: a
  // fully-planned line can still take excess, and hiding it would make
  // that impossible to do from here.
  const lines = order.elastics ?? [];

  const assessed = lines.map((e) => {
    const entered = Number(qty[e.id]) || 0;
    const alreadyPlanned = Math.max(0, e.ordered - e.notAssigned);
    const totalPlanned = alreadyPlanned + entered;
    const excess = Math.max(0, totalPlanned - e.ordered);
    const excessPct = e.ordered > 0 ? (excess / e.ordered) * 100 : 0;
    return { ...e, entered, alreadyPlanned, totalPlanned, excess, excessPct };
  });

  const rows = assessed
    .filter((r) => r.entered > 0)
    .map((r) => ({ elastic: r.id, quantity: r.entered }));

  const withExcess = assessed.filter((r) => r.entered > 0 && r.excess > 0);
  const needsReason = withExcess.some((r) => r.excessPct > FREE_EXCESS_PCT);
  const reasonOk = reason.trim().length >= MIN_REASON;

  if (lines.length === 0) {
    return <p className="text-sm text-ink-600">This order has no elastic lines.</p>;
  }

  return (
    <div className="space-y-4">
      <Input label="Job date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-600">
          Quantities — up to {FREE_EXCESS_PCT}% over the ordered figure needs no reason
        </p>
        <div className="grid grid-cols-[1fr_120px] gap-2 px-1 pb-1 text-xs font-medium text-ink-400">
          <span>Elastic</span><span>Qty (m)</span>
        </div>
        <div className="space-y-2">
          {assessed.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_120px] items-center gap-2">
              <div>
                <p className="text-sm font-medium">{e.name}</p>
                <p className="text-xs text-ink-400">
                  {fmt(e.notAssigned)} m not assigned of {fmt(e.ordered)} m ordered
                </p>
                {e.excess > 0 && (
                  <p
                    className={
                      e.excessPct > FREE_EXCESS_PCT
                        ? "text-xs font-medium text-status-warning"
                        : "text-xs text-ink-400"
                    }
                  >
                    {fmt(e.excess)} m over ({fmt(e.excessPct)}%)
                    {e.excessPct > FREE_EXCESS_PCT ? " — needs a reason" : ""}
                  </p>
                )}
              </div>
              <Input
                aria-label="Qty (m)"
                type="number"
                step="0.01"
                min={0}
                placeholder="Qty (m)"
                value={qty[e.id] ?? ""}
                onChange={(ev) => setQty((q) => ({ ...q, [e.id]: ev.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* The excess needs yarn the order's approval never drew. Say it
          here rather than letting a 409 be the first anyone hears. */}
      {withExcess.length > 0 && (
        <p className="flex gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Planning {fmt(withExcess.reduce((s, r) => s + r.excess, 0))} m over this order.
            The extra yarn will be deducted from stock when the job is created — if it is
            not there, the job is refused.
          </span>
        </p>
      )}

      {needsReason && (
        <div>
          <label
            htmlFor="excess-reason"
            className="mb-1.5 block text-sm font-medium text-ink-600"
          >
            Why is more than {FREE_EXCESS_PCT}% being planned?
          </label>
          <textarea
            id="excess-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. loom set for a full beam; the customer takes the overrun"
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          <p className="mt-1 text-xs text-ink-400">
            Shown on the order detail page, against the elastic it explains.
            At least {MIN_REASON} characters.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          disabled={rows.length === 0 || (needsReason && !reasonOk)}
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              {
                orderId: order._id,
                date,
                elastics: rows,
                ...(needsReason ? { excessReason: reason.trim() } : {}),
              },
              {
                onSuccess: (data) => {
                  toast(
                    `Job J-${data.job.jobOrderNo} created (warping & covering programmes opened)`,
                    "success"
                  );
                  onCreated(data.job._id);
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Failed to create job", "error"),
              }
            )
          }
        >
          Create job
        </Button>
      </div>
    </div>
  );
}
