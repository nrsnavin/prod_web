import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { OrderDetail } from "@/features/orders/types";
import { useJobMutations } from "./hooks";

// Creates a job from an order: pick quantities per pending elastic.
// The backend validates against Order.pendingElastic and auto-creates
// the warping + covering programmes.
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

  // The cap is what no job has claimed yet — a planning figure, not
  // what the customer is still owed.
  const pending = (order.elastics ?? []).filter((e) => e.notAssigned > 0);
  const rows = pending
    .map((e) => ({ elastic: e.id, quantity: Number(qty[e.id]) || 0 }))
    .filter((r) => r.quantity > 0);

  const overLimit = pending.some((e) => (Number(qty[e.id]) || 0) > e.notAssigned);

  if (pending.length === 0) {
    return (
      <p className="text-sm text-ink-600">
        All ordered quantities are already covered by jobs — nothing pending.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Input label="Job date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div>
        <p className="text-sm font-medium text-ink-600 mb-1.5">Quantities (pending shown)</p>
        <div className="grid grid-cols-[1fr_120px] gap-2 px-1 pb-1 text-xs font-medium text-ink-400"><span>Elastic</span><span>Qty (m)</span></div>
        <div className="space-y-2">
          {pending.map((e) => {
            const entered = Number(qty[e.id]) || 0;
            return (
              <div key={e.id} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                <div>
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-ink-400">{e.notAssigned.toLocaleString("en-IN")} m not assigned</p>
                </div>
                <Input aria-label="Qty (m)"
                  type="number"
                  step="0.01"
                  min={0}
                  max={e.notAssigned}
                  placeholder="Qty (m)"
                  value={qty[e.id] ?? ""}
                  error={entered > e.notAssigned ? "Exceeds what is unassigned" : undefined}
                  onChange={(ev) => setQty((q) => ({ ...q, [e.id]: ev.target.value }))}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          disabled={rows.length === 0 || overLimit}
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              { orderId: order._id, date, elastics: rows },
              {
                onSuccess: (data) => {
                  toast(`Job J-${data.job.jobOrderNo} created (warping & covering programmes opened)`, "success");
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
