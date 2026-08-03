import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, PackageCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useJobPurchaseOrders, useRaisePo } from "./hooks";
import { MrpData } from "./types";

/**
 * Turning a job's material shortfall into purchase orders.
 *
 * The MRP already said what was short. Acting on it meant re-keying the
 * same numbers into the PO screen, which lost the connection to the job
 * that needed them — so nobody could later answer "why did we buy this?"
 * or "what is on order to cover this job?".
 *
 * Only the gap is ordered. Stock already on hand is not bought twice.
 */

type MrpMaterial = MrpData["materials"][number];

const shortfallOf = (m: MrpMaterial) => {
  if (typeof m.shortfall === "number") return m.shortfall;
  const req = m.requiredWeight ?? m.required ?? m.quantity ?? 0;
  const stock = m.inStock ?? m.stock ?? m.available ?? 0;
  // Approving the parent order already drew this job's share out of
  // stock, so the part still owed — not the gross requirement — is what
  // the remaining balance has to cover.
  return Math.max(0, (m.outstanding ?? req - (m.allocated ?? 0)) - stock);
};

/**
 * What raising a PO from here would actually buy: the gap less what is
 * already on an open purchase order. A shortfall waiting on a delivery
 * has been bought once; buying it again is money out twice.
 */
const toBuyOf = (m: MrpMaterial) =>
  typeof m.toBuy === "number"
    ? m.toBuy
    : Math.max(0, shortfallOf(m) - (m.onOrder ?? 0));

const nameOf = (m: MrpMaterial) => m.name ?? m.materialName ?? "—";
// utils/materialRequirement.js names the reference `rawMaterial`; `id` is
// tolerated so an older payload still works.
const idOf = (m: MrpMaterial) => String(m.rawMaterial ?? m.id ?? "");

export function MrpShortfallPo({ jobId, materials }: { jobId: string; materials: MrpMaterial[] }) {
  const { toast } = useToast();
  const raisePo = useRaisePo(jobId);
  const { data: raised } = useJobPurchaseOrders(jobId);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  // A material whose reference could not be resolved has a placeholder
  // stock figure, so its shortfall is not a reading — never order on it.
  const short = useMemo(
    () => materials.filter((m) => m.stockKnown !== false && shortfallOf(m) > 0),
    [materials]
  );
  // Short AND not already bought. Pressing the button while the first
  // PO was still in transit used to raise a second one for the same
  // quantity — the shortfall had not moved because the yarn had not
  // arrived, which is exactly when it must not be ordered again.
  const toBuy = short.filter((m) => toBuyOf(m) > 0);
  const awaitingDelivery = short.filter((m) => toBuyOf(m) <= 0);
  const orderable = toBuy.filter((m) => m.supplierId);
  const noSupplier = toBuy.filter((m) => !m.supplierId);

  const selected = orderable.filter((m) => picked[idOf(m)] ?? true);

  // Grouped exactly as the server will group them, so the preview is not
  // a different story from what gets created.
  const bySupplier = useMemo(() => {
    const map = new Map<string, { name: string; lines: MrpMaterial[]; value: number }>();
    for (const m of selected) {
      const key = String(m.supplierId);
      if (!map.has(key)) map.set(key, { name: m.supplierName || "Supplier", lines: [], value: 0 });
      const g = map.get(key)!;
      g.lines.push(m);
      g.value += toBuyOf(m) * (m.unitPrice ?? 0);
    }
    return Array.from(map.values());
  }, [selected]);

  if (short.length === 0 && (raised?.length ?? 0) === 0) return null;

  return (
    <>
      {short.length > 0 && (
        <Card className="p-5 border-l-4 border-status-danger">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold">
                {short.length} material{short.length === 1 ? "" : "s"} short for this job
              </h3>
              <p className="text-xs text-ink-400">
                Raise a purchase order for the gap. Stock already on hand is not ordered again,
                and the PO stays linked to this job.
              </p>
            </div>
            <Button
              disabled={orderable.length === 0}
              onClick={() => setOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" /> Raise PO for shortfall
            </Button>
          </div>

          <ul className="mt-3 divide-y divide-ink-100">
            {short.map((m) => (
              <li key={idOf(m)} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 font-medium">{nameOf(m)}</span>
                {/* A material with no supplier cannot be ordered at all —
                    say so here rather than letting it fail on submit. */}
                {m.supplierId ? (
                  <span className="text-xs text-ink-400">{m.supplierName}</span>
                ) : (
                  <StatusChip tone="warning">no supplier set</StatusChip>
                )}
                <span className="tabular-nums font-semibold text-status-danger">
                  {shortfallOf(m).toLocaleString("en-IN")} short
                </span>
                {/* Short, but bought. Different problem, different
                    answer: chase the supplier, do not buy again. */}
                {toBuyOf(m) <= 0 && (
                  <StatusChip tone="info">on order</StatusChip>
                )}
              </li>
            ))}
          </ul>

          {awaitingDelivery.length > 0 && (
            <p className="mt-2 text-xs text-status-info">
              {awaitingDelivery.map(nameOf).join(", ")} already bought and awaiting delivery —
              nothing further to order.
            </p>
          )}

          {noSupplier.length > 0 && (
            <p className="mt-2 text-xs text-status-warning">
              {noSupplier.map(nameOf).join(", ")} cannot be ordered until a supplier is set on
              the material.
            </p>
          )}
        </Card>
      )}

      {(raised?.length ?? 0) > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold">On order for this job</h3>
          <ul className="mt-2 divide-y divide-ink-100">
            {raised!.map((po) => (
              <li key={po._id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link to={`/purchase-orders/${po._id}`} className="font-medium text-brand-600 hover:underline">
                  PO #{po.poNo ?? "—"}
                </Link>
                <span className="text-xs text-ink-400">{po.supplier?.name}</span>
                <StatusChip tone={po.status === "Completed" ? "success" : "info"}>
                  {po.status}
                </StatusChip>
                <span className="ml-auto text-xs text-ink-600">
                  {po.items.length} line{po.items.length === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Raise purchase orders" width="max-w-2xl">
        <p className="text-sm text-ink-600">
          One purchase order per supplier — that is what the document is. Only the gap is
          ordered: not the whole requirement, and not what is already on order.
        </p>

        <div className="mt-4 space-y-2">
          {orderable.map((m) => {
            const id = idOf(m);
            const on = picked[id] ?? true;
            return (
              <label key={id} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  aria-label={`Order ${nameOf(m)}`}
                  onChange={(e) => setPicked((p) => ({ ...p, [id]: e.target.checked }))}
                  className="h-4 w-4 accent-brand-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{nameOf(m)}</span>
                  <span className="ml-2 text-xs text-ink-400">{m.supplierName}</span>
                </span>
                <span className="tabular-nums">{toBuyOf(m).toLocaleString("en-IN")}</span>
              </label>
            );
          })}
        </div>

        {bySupplier.length > 0 && (
          <div className="mt-4 rounded-lg bg-ink-100/40 px-3 py-2 text-sm">
            <p className="font-medium">
              {bySupplier.length} purchase order{bySupplier.length === 1 ? "" : "s"} will be created
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-ink-600">
              {bySupplier.map((g) => (
                <li key={g.name}>
                  {g.name} — {g.lines.length} line{g.lines.length === 1 ? "" : "s"}, ≈ ₹
                  {Math.round(g.value).toLocaleString("en-IN")}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            label="Expected delivery"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
          <Input
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={raisePo.isPending}>
            Cancel
          </Button>
          <Button
            disabled={selected.length === 0}
            loading={raisePo.isPending}
            onClick={() =>
              raisePo.mutate(
                {
                  materials: selected.map(idOf),
                  expectedDate: expectedDate || undefined,
                  notes: notes.trim() || undefined,
                },
                {
                  onSuccess: (res) => {
                    setOpen(false);
                    toast(
                      `${res.purchaseOrders.length} purchase order${
                        res.purchaseOrders.length === 1 ? "" : "s"
                      } raised`,
                      "success"
                    );
                    // Anything the server could not order is worth saying
                    // out loud — it is the part that still needs doing.
                    if (res.skipped.length > 0) {
                      toast(
                        `Not ordered: ${res.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}`,
                        "error"
                      );
                    }
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Could not raise the PO", "error"),
                }
              )
            }
          >
            <PackageCheck className="h-4 w-4" /> Raise{" "}
            {bySupplier.length > 1 ? `${bySupplier.length} POs` : "PO"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
