import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { elasticService } from "@/features/elastics/api";
import { useDcMutations } from "./hooks";
import { DcItem, DeliveryChallan } from "./types";

/** The elastic id on a line, whether the API populated it or not. */
export function itemElasticId(item: DcItem): string {
  if (!item.elastic) return "";
  return typeof item.elastic === "object" ? item.elastic._id : item.elastic;
}

/** The name to show for a line, from whichever field carries it. */
export function itemElasticName(item: DcItem): string {
  if (item.elasticName) return item.elasticName;
  if (item.elastic && typeof item.elastic === "object") return item.elastic.name;
  return item.description ?? "";
}

export type EditLine = {
  elastic: string;
  elasticName: string;
  description: string;
  quantity: string;
  rate: string;
};

export function linesFromDc(dc: DeliveryChallan): EditLine[] {
  const items = dc.items ?? [];
  if (items.length === 0) {
    return [{ elastic: "", elasticName: "", description: "", quantity: "", rate: "" }];
  }
  return items.map((it) => ({
    elastic: itemElasticId(it),
    elasticName: itemElasticName(it),
    description: it.description ?? "",
    quantity: String(it.quantity ?? ""),
    rate: String(it.rate ?? ""),
  }));
}

/**
 * Did the lines actually change?
 *
 * This decides whether the request carries `items` at all, and that is
 * not cosmetic: sending `items` makes the backend reverse every line
 * and re-apply it, which writes stock movements. Correcting a vehicle
 * number should not leave a DC_CANCEL_RETURN / DC_OUT pair in the
 * elastic's ledger for a despatch that never changed.
 */
export function linesChanged(before: EditLine[], after: EditLine[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((b, i) => {
    const a = after[i];
    return (
      b.elastic !== a.elastic ||
      b.description !== a.description ||
      Number(b.quantity) !== Number(a.quantity) ||
      Number(b.rate) !== Number(a.rate)
    );
  });
}

export function DcEditModal({
  dc,
  open,
  onClose,
}: {
  dc: DeliveryChallan;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { update } = useDcMutations();
  const isElastic = dc.type === "elastic";

  const original = useMemo(() => linesFromDc(dc), [dc]);
  const [lines, setLines] = useState<EditLine[]>(original);
  const [customerName, setCustomerName] = useState(dc.customerName ?? "");
  const [dispatchDate, setDispatchDate] = useState(
    dc.dispatchDate ? dc.dispatchDate.slice(0, 10) : ""
  );
  const [vehicleNo, setVehicleNo] = useState(dc.vehicleNo ?? "");
  const [driverName, setDriverName] = useState(dc.driverName ?? "");
  const [transporter, setTransporter] = useState(dc.transporter ?? "");
  const [lrNumber, setLrNumber] = useState(dc.lrNumber ?? "");
  const [remarks, setRemarks] = useState(dc.remarks ?? "");
  const [auditReason, setAuditReason] = useState("");

  // The combobox hands back an id, not the option. The stored line also
  // carries `elasticName` — it is what the printed challan and the PDF
  // show — so swapping the elastic while keeping the old name would put
  // one product's name against another's stock movement. Every option
  // that passes through here is remembered so the name can follow the id.
  const [labelById, setLabelById] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (dc.items ?? [])
        .filter((it) => itemElasticId(it))
        .map((it) => [itemElasticId(it), itemElasticName(it)])
    )
  );
  const loadElastics = useCallback(async (q: string) => {
    const r = await elasticService.list({ page: 1, search: q, limit: 50 });
    const options = r.elastics.map((e) => ({ value: e._id, label: e.name }));
    setLabelById((prev) => ({
      ...prev,
      ...Object.fromEntries(options.map((o) => [o.value, o.label])),
    }));
    return options;
  }, []);
  // So a line the DC already holds shows its name before any search runs.
  const seed = useMemo(
    () =>
      original
        .filter((l) => l.elastic)
        .map((l) => ({ value: l.elastic, label: l.elasticName || l.elastic })),
    [original]
  );

  const setLine = (i: number, patch: Partial<EditLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { elastic: "", elasticName: "", description: "", quantity: "", rate: "" },
    ]);
  const removeLine = (i: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalValue = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0),
    0
  );
  const itemsMoved = linesChanged(original, lines);

  const save = () => {
    if (auditReason.trim().length < 3) {
      toast("Give a reason (min 3 chars) for the edit", "error");
      return;
    }
    if (lines.some((l) => !(Number(l.quantity) > 0))) {
      toast("Every line needs a quantity greater than 0", "error");
      return;
    }
    if (isElastic && lines.some((l) => !l.elastic)) {
      // A line with no elastic moves no stock, so the challan would say
      // goods went out while the shelf still counted them.
      toast("Pick the elastic on every line — a blank line moves no stock", "error");
      return;
    }

    update.mutate(
      {
        id: dc._id,
        auditReason: auditReason.trim(),
        customerName,
        dispatchDate,
        vehicleNo,
        driverName,
        transporter,
        lrNumber,
        remarks,
        // Only when they changed — see `linesChanged`.
        ...(itemsMoved
          ? {
              items: lines.map((l) => ({
                elastic: l.elastic || undefined,
                elasticName: l.elasticName,
                description: l.description,
                quantity: Number(l.quantity) || 0,
                rate: Number(l.rate) || 0,
              })),
            }
          : {}),
      },
      {
        onSuccess: () => {
          toast(
            itemsMoved ? "Challan updated — stock adjusted" : "Challan updated",
            "success"
          );
          onClose();
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Update failed", "error"),
      }
    );
  };

  return (
    <FormScreen open={open} onClose={onClose} title={`Edit ${dc.dcNumber}`} width="max-w-2xl">
      <div className="space-y-4">
        {/* Said plainly, because it is the whole difference between this
            form and an ordinary one: changing a line here moves goods. */}
        <p className="rounded-lg bg-status-warningBg px-3 py-2 text-xs text-status-warning">
          Changing a line puts the old quantity back on the shelf and takes the new
          one out again, and the order&apos;s reservation follows. Vehicle, driver
          and remarks can be corrected without touching stock.
        </p>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-600">
            Items * {itemsMoved && <span className="text-status-warning">· stock will move</span>}
          </p>
          <div className="hidden grid-cols-[1fr_90px_100px_32px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
            <span>{isElastic ? "Elastic" : "Part description"}</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate (₹)</span>
            <span />
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_100px_32px] items-start gap-2">
                {isElastic ? (
                  <AsyncCombobox
                    aria-label="Elastic"
                    placeholder="Select elastic"
                    loadOptions={loadElastics}
                    seedOptions={seed}
                    value={l.elastic}
                    onChange={(v) =>
                      setLine(i, { elastic: v, elasticName: labelById[v] ?? "" })
                    }
                  />
                ) : (
                  <Input
                    aria-label="Part description"
                    placeholder="Part description"
                    value={l.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                  />
                )}
                <Input
                  type="number"
                  step="0.01"
                  aria-label="Quantity"
                  placeholder="Qty"
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  aria-label="Rate in rupees (internal — not printed on the challan)"
                  placeholder="Rate"
                  title="Internal only — used by the Dispatch Report. Never printed on the challan."
                  value={l.rate}
                  onChange={(e) => setLine(i, { rate: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="grid h-10 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
                  disabled={lines.length <= 1}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
            <span className="text-sm tabular-nums text-ink-600">
              Total qty <span className="font-semibold text-ink-900">{totalQty.toLocaleString("en-IN")}</span>
              {" · "}
              <span className="text-ink-400">₹{totalValue.toLocaleString("en-IN")} internal</span>
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Input label="Dispatch date" type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="Vehicle no" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
          <Input label="Driver" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          <Input label="Transporter" value={transporter} onChange={(e) => setTransporter(e.target.value)} />
          <Input label="LR number" value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} />
        </div>
        <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

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
          <Button type="button" loading={update.isPending} onClick={save}>Save changes</Button>
        </div>
      </div>
    </FormScreen>
  );
}
