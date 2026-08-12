import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { useOrderDeliveryChallans } from "./hooks";
import type { DcStatus, OrderDcRow } from "./types";

/**
 * The delivery notes raised against this order.
 *
 * The page could say what was ordered, planned, produced and packed,
 * and then stopped. Whether any of it had actually been DESPATCHED —
 * and on which note — meant leaving the order, opening the DC list and
 * searching it by order number. That is the question customers ring up
 * about, so it belongs here.
 *
 * Cancelled notes are shown but struck from the totals. Somebody raised
 * them, and "why is there a gap in the DC numbers" has to have an
 * answer — but nothing left the building on them.
 */

const statusTone: Record<DcStatus, ChipTone> = {
  draft:      "neutral",
  dispatched: "info",
  delivered:  "success",
  cancelled:  "danger",
};

const nf = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

/** Vehicle, transporter and LR, when there are any — the despatch trail. */
function Carriage({ dc }: { dc: OrderDcRow }) {
  const parts = [dc.vehicleNo, dc.transporter, dc.lrNumber && `LR ${dc.lrNumber}`]
    .filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="text-xs text-ink-400">{parts.join(" · ")}</p>;
}

export function OrderDeliveryChallans({ orderId }: { orderId: string }) {
  const { data, isLoading } = useOrderDeliveryChallans(orderId);

  if (isLoading) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Delivery challans</h3>
        <Skeleton className="mt-3 h-24 w-full" />
      </Card>
    );
  }
  if (!data) return null;

  const { dcs, lines, totals } = data;

  return (
    <Card className="mt-4">
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Delivery challans</h3>
          {totals.count > 0 && (
            <StatusChip tone="info">
              {totals.count} note{totals.count === 1 ? "" : "s"}
            </StatusChip>
          )}
          {totals.cancelled > 0 && (
            <StatusChip tone="danger">{totals.cancelled} cancelled</StatusChip>
          )}
        </div>
        {totals.count > 0 && (
          <p className="mt-1 text-sm text-ink-400">
            {nf(totals.dispatched)} of {nf(totals.ordered)} despatched
            {totals.ordered > totals.dispatched && (
              <> · {nf(totals.ordered - totals.dispatched)} still to go</>
            )}
          </p>
        )}
      </div>

      {dcs.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="Nothing despatched yet"
            description="Delivery challans raised against this order will appear here."
          />
        </div>
      ) : (
        <>
          {/* ── Ordered against despatched, per product ─────────────
              The reason for the panel: not "which notes exist" but
              "how much is still owed". Stated per elastic, because an
              order part-delivered on one product and untouched on
              another reads as half-done either way in a single total. */}
          {lines.length > 0 && (
            <div className="mt-4 overflow-x-auto px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2 text-left font-medium">Product</th>
                    <th className="py-2 text-right font-medium">Ordered</th>
                    <th className="py-2 text-right font-medium">Despatched</th>
                    <th className="py-2 text-right font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {lines.map((l) => (
                    <tr key={l.elasticId}>
                      <td className="py-2 pr-3 font-medium">{l.elasticName || "—"}</td>
                      <td className="py-2 text-right tabular-nums text-ink-600">
                        {nf(l.ordered)}
                      </td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {nf(l.dispatched)}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right tabular-nums",
                          l.pending > 0 && "text-status-warning",
                          // More went out than was ordered. Worth seeing,
                          // not worth hiding behind a clamp at zero.
                          l.pending < 0 && "text-status-danger font-semibold"
                        )}
                      >
                        {l.pending < 0 ? `+${nf(-l.pending)} over` : nf(l.pending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── The notes themselves ────────────────────────────── */}
          <div className="mt-4 divide-y divide-ink-100 border-t border-ink-200">
            {dcs.map((dc) => (
              <div
                key={dc.id}
                className={cn("px-5 py-3", dc.status === "cancelled" && "opacity-60")}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link
                      to={`/delivery-challans/${dc.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {dc.dcNumber}
                    </Link>
                    <span className="ml-2 text-xs text-ink-400">
                      {day(dc.dispatchDate ?? dc.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm">
                      {nf(dc.totalQuantity)} m
                    </span>
                    <StatusChip tone={statusTone[dc.status] ?? "neutral"}>
                      {dc.status}
                    </StatusChip>
                  </div>
                </div>

                {dc.items.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    {dc.items
                      .map((i) => `${i.elasticName || "—"} ${nf(i.quantity)}${i.unit}`)
                      .join(" · ")}
                  </p>
                )}
                <Carriage dc={dc} />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
