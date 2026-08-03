import { Link } from "react-router-dom";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLot } from "./hooks";
import type { LotMovement, YarnLot } from "./types";

/**
 * How long a lot has sat on the rack, as a chip.
 *
 * Dyed yarn is not indefinitely interchangeable with itself: the lot
 * that has been there longest is the one to use up first, and the one to
 * look at when a shade complaint arrives. The rack cannot show this, so
 * the system has to.
 *
 * Nothing is shown for a lot holding nothing — an exhausted lot's age is
 * history, and colouring it "critical" would bury the lots that matter.
 */
export function LotAge({ lot }: { lot: YarnLot }) {
  if (lot.ageDays == null || !lot.ageBucket) return null;

  const tone =
    lot.ageBucket === "fresh"
      ? ("success" as const)
      : lot.ageBucket === "watch"
        ? ("info" as const)
        : lot.ageBucket === "late"
          ? ("warning" as const)
          : ("danger" as const);

  return (
    <StatusChip tone={tone}>
      {lot.ageDays === 0 ? "today" : `${lot.ageDays}d on rack`}
    </StatusChip>
  );
}

/**
 * A lot's own ledger.
 *
 * Its balance was two running totals — received less issued — and a
 * running total cannot be audited: it says a lot has 40 kg left without
 * saying when the rest went or who took it. This is the row-by-row
 * account that explains the balance beside it.
 *
 * Loaded only when a lot is expanded: the ledger is select:false on the
 * server, and there is no reason to drag every lot's history into a list
 * nobody has opened.
 */
export function LotLedger({ lotId }: { lotId: string }) {
  const { data, isLoading } = useLot(lotId);

  if (isLoading) return <Skeleton className="mt-2 h-16 w-full" />;
  if (!data) return null;

  const movements = data.movements ?? [];
  if (movements.length === 0) {
    return (
      <p className="mt-2 text-xs text-ink-400">
        {/* Lots that predate this ledger have a balance and no rows. Say
            which it is rather than showing an empty box. */}
        No movements recorded on this lot yet — its balance predates the lot ledger.
      </p>
    );
  }

  return (
    <table className="mt-2 w-full text-xs">
      <thead>
        <tr className="text-left text-ink-400">
          <th className="py-1 font-medium">Date</th>
          <th className="py-1 font-medium">What</th>
          <th className="py-1 font-medium">Why</th>
          <th className="py-1 text-right font-medium">Qty</th>
          <th className="py-1 text-right font-medium">Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-100">
        {movements.map((m, i) => (
          <LedgerRow key={`${m.date}-${m.type}-${i}`} movement={m} />
        ))}
      </tbody>
    </table>
  );
}

function LedgerRow({ movement: m }: { movement: LotMovement }) {
  return (
    <tr>
      <td className="py-1 text-ink-600">{new Date(m.date).toLocaleDateString()}</td>
      <td className="py-1">{m.typeLabel ?? m.type}</td>
      <td className="py-1 text-ink-600">
        {m.reference ? (
          m.referenceId ? (
            <Link to={`/warping`} className="text-brand-600 hover:underline">
              {m.reference}
            </Link>
          ) : (
            m.reference
          )
        ) : m.reason ? (
          <>
            {m.reason}
            {m.by ? <span className="text-ink-400"> · {m.by}</span> : null}
          </>
        ) : (
          <span className="text-ink-400">—</span>
        )}
      </td>
      <td
        className={
          m.quantity > 0
            ? "py-1 text-right font-semibold tabular-nums text-status-success"
            : m.quantity < 0
              ? "py-1 text-right font-semibold tabular-nums text-status-danger"
              : "py-1 text-right tabular-nums text-ink-400"
        }
      >
        {/* The sign is the whole point of the column, so it is written
            rather than left to the formatter. */}
        {m.quantity > 0 ? "+" : m.quantity < 0 ? "−" : ""}
        {Math.abs(m.quantity).toLocaleString("en-IN")}
      </td>
      <td className="py-1 text-right tabular-nums text-ink-600">
        {m.balance == null ? "—" : m.balance.toLocaleString("en-IN")}
      </td>
    </tr>
  );
}
