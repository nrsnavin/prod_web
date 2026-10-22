import { useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { elasticService } from "@/features/elastics/api";
import { ForceApprovalDialog } from "./ForceApprovalDialog";
import { useOrderMutations } from "./hooks";
import { OrderDetail, StockShortfall } from "./types";

// ══════════════════════════════════════════════════════════════════
//  ADDING AN ELASTIC TO AN APPROVED ORDER — the rare case
//
//  Approval drew the yarn for the lines the order had. Adding one
//  afterwards draws its own yarn the same way: short of stock it is
//  refused with the shortfall, and the force prompt (the approval
//  one) lets somebody draw what there is, with a reason. Once on the
//  order, the elastic can be raised as a job or put on a running loom.
// ══════════════════════════════════════════════════════════════════

const MIN_REASON = 8;

export function OrderAddElasticModal({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { addElastic } = useOrderMutations();
  const [openedVersion] = useState(order.__v);
  const [elastic, setElastic] = useState("");
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  const [shortfall, setShortfall] = useState<{ shortfall: StockShortfall | null; message: string } | null>(null);

  const onOrder = new Set(order.elastics.map((e) => String(e.id)));
  const loadElastics = useCallback(
    (q: string) =>
      elasticService.list({ page: 1, search: q, limit: 50 })
        .then((r) => r.elastics.filter((e) => !onOrder.has(String(e._id))).map((e) => ({ value: e._id, label: e.name }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order.elastics]
  );

  const qty = Number(quantity);
  const problem =
    !elastic ? "Choose the elastic to add"
      : !(qty > 0) ? "Quantity must be greater than 0"
        : rate !== "" && !(Number(rate) >= 0) ? "Rate must be 0 or more"
          : reason.trim().length < MIN_REASON ? `Give the reason (at least ${MIN_REASON} characters)`
            : null;

  const submit = (force = false, forceReason?: string) =>
    addElastic.mutate(
      {
        id: order._id,
        body: {
          elastic, quantity: qty, auditReason: reason.trim(), expectedVersion: openedVersion,
          ...(rate !== "" ? { rate: Number(rate) } : {}),
          ...(force ? { force: true, forceReason } : {}),
        },
      },
      {
        onSuccess: (res) => {
          setShortfall(null);
          toast(res.message, "success");
          onClose();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === "INSUFFICIENT_STOCK") {
            setShortfall({ shortfall: (e.data?.shortfall as StockShortfall) ?? null, message: e.message });
            return;
          }
          setShortfall(null);
          toast(e instanceof ApiError ? e.message : "Could not add the elastic", "error");
        },
      }
    );

  return (
    <FormScreen open={open} onClose={onClose} title={`Add elastic to order #${order.orderNo}`} width="max-w-lg">
      <div className="space-y-4 text-sm">
        <p className="flex items-start gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-xs text-status-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This order is approved, so its yarn has been drawn. The elastic added here draws its
            own yarn now; if stock is short you will be asked to force it. Recorded with your reason.
          </span>
        </p>

        <AsyncCombobox
          label="Elastic *"
          placeholder="Search elastics"
          loadOptions={loadElastics}
          value={elastic}
          onChange={setElastic}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity (m) *" type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input label="Rate (₹/m)" type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0 = not priced yet" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason *</label>
          <textarea
            aria-label="Reason for adding"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer added it to the PO after approval"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {problem && elastic && <span className="text-xs text-status-danger">{problem}</span>}
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={addElastic.isPending} disabled={!!problem} onClick={() => submit()}>
            Add elastic
          </Button>
        </div>
      </div>

      <ForceApprovalDialog
        open={!!shortfall}
        shortfall={shortfall?.shortfall ?? null}
        originalMessage={shortfall?.message}
        loading={addElastic.isPending}
        onClose={() => setShortfall(null)}
        onConfirm={(forceReason) => submit(true, forceReason)}
      />
    </FormScreen>
  );
}
