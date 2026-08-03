import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, PackageCheck, Boxes, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useOrderMrp, useOrderPurchaseOrders, useOrderRaisePo } from "./hooks";
import { OrderMrpMaterial } from "./types";

/**
 * Raw material for a whole order, and the purchase orders raised for it.
 *
 * The job-level MRP answers what one run needs. This answers what the
 * ORDER needs — including quantity no job has been raised for yet, which
 * is precisely the part that has to be bought before the work can be
 * planned at all. Buying only against planned jobs is how an order gets
 * to its supply date with yarn still unordered.
 */

/**
 * What still has to come out of stock.
 *
 * Approving the order took its material out already, so `inStock` is
 * the balance with this order's needs removed — the requirement to
 * measure it against is the part not yet drawn, not the gross one.
 */
const outstandingOf = (m: OrderMrpMaterial) =>
  typeof m.outstanding === "number"
    ? m.outstanding
    : Math.max(0, (m.requiredWeight ?? 0) - (m.allocated ?? 0));

const shortfallOf = (m: OrderMrpMaterial) =>
  typeof m.shortfall === "number"
    ? m.shortfall
    : Math.max(0, outstandingOf(m) - (m.inStock ?? 0));

/**
 * What buying from here would actually order: the gap less what is on
 * order already. A shortfall waiting on a delivery does not want a
 * second purchase order.
 */
const toBuyOf = (m: OrderMrpMaterial) =>
  typeof m.toBuy === "number"
    ? m.toBuy
    : Math.max(0, shortfallOf(m) - (m.onOrder ?? 0));

const idOf = (m: OrderMrpMaterial) => String(m.rawMaterial ?? "");
const nameOf = (m: OrderMrpMaterial) => m.name ?? "—";
const kg = (n: number) => n.toLocaleString("en-IN");

export function OrderMaterialPo({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const { data: mrp, isLoading } = useOrderMrp(orderId);
  const { data: raised } = useOrderPurchaseOrders(orderId);
  const raisePo = useOrderRaisePo(orderId);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  const materials = mrp?.materials ?? [];
  // A material whose reference could not be resolved has a placeholder
  // stock figure, so its shortfall is not a reading — never buy on it.
  const short = useMemo(
    () => materials.filter((m) => m.stockKnown !== false && shortfallOf(m) > 0),
    [materials]
  );
  // Short AND not already bought. The two used to be the same list, so
  // pressing the button while the first PO was in transit raised a
  // second one for the same yarn.
  const toBuy = short.filter((m) => toBuyOf(m) > 0);
  const awaitingDelivery = short.filter((m) => toBuyOf(m) <= 0);
  const orderable = toBuy.filter((m) => m.supplierId);
  const noSupplier = toBuy.filter((m) => !m.supplierId);
  const selected = orderable.filter((m) => picked[idOf(m)] ?? true);
  const anyAllocated = materials.some((m) => (m.allocated ?? 0) > 0);

  /**
   * Buying for an order happens BEFORE it is approved.
   *
   * Approval allocates the stock to the order — takes it out of the
   * balance and holds it — so from that point the material question is
   * settled and this panel reports, it does not purchase. The server
   * refuses the same call with ORDER_ALREADY_APPROVED, so removing the
   * button here is not the only thing standing between the two.
   */
  // An absent status is read as not-approved on purpose. If it turns out
  // the order WAS approved the server refuses the call and says why —
  // whereas guessing the other way would quietly remove the only way to
  // buy for an order that has not been approved at all.
  const approved = !!mrp?.status && mrp.status !== "Open";
  // A forced approval took only what was there. That remainder is real
  // and nothing is holding it, so it gets said out loud rather than
  // disappearing behind the allocation notice.
  const unallocated = approved
    ? materials.filter((m) => (m.allocated ?? 0) > 0 && outstandingOf(m) > 0)
    : [];

  const bySupplier = useMemo(() => {
    const map = new Map<string, { name: string; lines: OrderMrpMaterial[]; value: number }>();
    for (const m of selected) {
      const key = String(m.supplierId);
      if (!map.has(key)) map.set(key, { name: m.supplierName || "Supplier", lines: [], value: 0 });
      const g = map.get(key)!;
      g.lines.push(m);
      g.value += toBuyOf(m) * (m.unitPrice ?? 0);
    }
    return Array.from(map.values());
  }, [selected]);

  if (isLoading) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Raw material for this order</h3>
        <Skeleton className="mt-3 h-24 w-full" />
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h3 className="font-semibold">Raw material for this order</h3>
            <p className="text-xs text-ink-400">
              {approved
                ? "Stock for this order was allocated when it was approved — held against the order and already out of the balance below. Buying happens before approval."
                : "The requirement for everything ordered, not only what has been planned into jobs. Only the gap is bought — never stock on hand, never what is already on an open PO — and what is bought stays linked to this order."}
            </p>
          </div>
          {!approved && toBuy.length > 0 && (
            <Button disabled={orderable.length === 0} onClick={() => setOpen(true)}>
              <ShoppingCart className="h-4 w-4" /> Raise PO for shortfall
            </Button>
          )}
          {approved && (
            <StatusChip tone="success">
              <Lock className="h-3 w-3" /> Stock allocated
            </StatusChip>
          )}
        </div>

        {materials.length === 0 ? (
          <EmptyState
            title="No material requirement"
            description="No BOM materials resolved for the elastics on this order."
            icon={<Boxes className="h-6 w-6" />}
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/40 text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Material</th>
                  <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-right font-semibold">Required</th>
                  {/* Only once there is something to show. Before
                      approval every row reads nil, and a column of
                      dashes is noise on the screen that matters most. */}
                  {anyAllocated && (
                    <>
                      <th className="px-3 py-2 text-right font-semibold">Allocated</th>
                      <th className="px-3 py-2 text-right font-semibold">Unallocated</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-right font-semibold">In stock</th>
                  {/* On order sits between stock and shortfall because
                      that is the order the question is asked in: what is
                      here, what is coming, what is still missing. */}
                  <th className="px-3 py-2 text-right font-semibold">On order</th>
                  <th className="px-5 py-2 text-right font-semibold">Shortfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {materials.map((m) => {
                  const s = shortfallOf(m);
                  return (
                    <tr key={idOf(m)} className={s > 0 ? "bg-status-dangerBg/40" : undefined}>
                      <td className="px-5 py-2 font-medium">{nameOf(m)}</td>
                      <td className="px-3 py-2 text-xs">
                        {m.supplierId ? (
                          <span className="text-ink-400">{m.supplierName}</span>
                        ) : (
                          <StatusChip tone="warning">not set</StatusChip>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {kg(m.requiredWeight ?? 0)}
                      </td>
                      {anyAllocated && (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {(m.allocated ?? 0) > 0 ? (
                              <span
                                className="font-medium text-status-success"
                                title="Held for this order since approval — taken out of the stock figure beside it, not available to anything else"
                              >
                                {kg(m.allocated ?? 0)}
                              </span>
                            ) : (
                              <span className="text-ink-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {outstandingOf(m) > 0 ? (
                              <span
                                title="Not held for this order — a forced approval took only what was in stock at the time"
                              >
                                {kg(outstandingOf(m))}
                              </span>
                            ) : (
                              <span className="text-ink-400">—</span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 text-right tabular-nums">
                        {m.stockKnown === false ? "unknown" : kg(m.inStock ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {(m.onOrder ?? 0) > 0 ? (
                          <span
                            className="text-status-info"
                            title="Outstanding on open purchase orders — bought, not yet received"
                          >
                            {kg(m.onOrder ?? 0)}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td
                        className={`px-5 py-2 text-right tabular-nums ${
                          s > 0 ? "font-semibold text-status-danger" : "text-ink-400"
                        }`}
                      >
                        {s > 0 ? kg(s) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* The one thing an approved order can still be missing.
            Removing the button must not also remove the news: a forced
            approval took what was in stock and left the rest owed, with
            nothing holding it. Said here, with where to go, rather than
            left to be discovered when the machine stops. */}
        {unallocated.length > 0 && (
          <p className="px-5 pt-2 text-xs text-status-warning">
            Approved on part stock —{" "}
            {unallocated.map((m) => `${nameOf(m)} (${kg(outstandingOf(m))})`).join(", ")}{" "}
            {unallocated.length === 1 ? "is" : "are"} not allocated to this order. Buy{" "}
            {unallocated.length === 1 ? "it" : "them"} from the job that needs the material, or from
            the purchase-order screen.
          </p>
        )}

        {/* A shortfall already covered by an open PO needs no second
            purchase order — and now cannot get one. */}
        {awaitingDelivery.length > 0 && (
          <p className="px-5 pt-2 text-xs text-status-info">
            {awaitingDelivery.map((m) => `${nameOf(m)} (${kg(m.onOrder ?? 0)})`).join(", ")} already
            bought and awaiting delivery — nothing further to order.
          </p>
        )}

        {!approved && noSupplier.length > 0 && (
          <p className="px-5 pb-4 pt-2 text-xs text-status-warning">
            {noSupplier.map(nameOf).join(", ")} cannot be ordered until a supplier is set on
            the material.
          </p>
        )}
      </Card>

      {(raised?.length ?? 0) > 0 && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold">On order for this order</h3>
          <ul className="mt-2 divide-y divide-ink-100">
            {raised!.map((po) => (
              <li key={po._id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link
                  to={`/purchase-orders/${po._id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  PO #{po.poNo ?? "—"}
                </Link>
                <span className="text-xs text-ink-400">{po.supplier?.name}</span>
                {/* A PO raised off one of this order's jobs is the same
                    spend from here; saying which job keeps it traceable. */}
                {po.forJob && (
                  <span className="text-xs text-ink-400">via J-{po.forJob.jobOrderNo}</span>
                )}
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
          One purchase order per supplier. Only the gap is bought — neither stock already on
          hand nor quantity already on an open purchase order is ordered again.
        </p>

        <div className="mt-4 space-y-2">
          {orderable.map((m) => {
            const id = idOf(m);
            const on = picked[id] ?? true;
            return (
              <label
                key={id}
                className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2 text-sm"
              >
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
                <span className="tabular-nums">{kg(toBuyOf(m))}</span>
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
                    // What could not be ordered is the part still needing
                    // attention, so it gets said rather than swallowed.
                    if (res.skipped.length > 0) {
                      toast(
                        `Not ordered: ${res.skipped
                          .map((s) => `${s.name} (${s.reason})`)
                          .join(", ")}`,
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
