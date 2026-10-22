import { PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDate } from "@/core/format/date";
import { OrderAmendmentRow } from "./types";

// Elastics added to this order after approval.
//
// Its own card, like excess planning: each is a decision someone made
// on a date with a reason, and it is what explains a yarn draw on the
// order's ledger that its original lines do not account for. Absent
// entirely when nothing was added.

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString("en-IN");

export function OrderAmendments({ rows }: { rows: OrderAmendmentRow[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <PlusCircle className="h-4 w-4 text-status-info" />
          Added after approval
        </h2>
        <p className="mt-0.5 text-sm text-ink-400">
          {rows.length} elastic{rows.length === 1 ? "" : "s"} added to the order after its yarn was drawn; each drew its own.
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Elastic</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
              <th className="px-4 py-3 font-medium">Yarn drawn</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r, i) => (
              <tr key={`${r.elastic}-${i}`} className="align-top">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.quantity)} m</td>
                <td className="px-4 py-3">
                  {r.materialsDrawn.length === 0 ? (
                    <span className="text-ink-400">none needed</span>
                  ) : (
                    <ul className="space-y-0.5 tabular-nums">
                      {r.materialsDrawn.map((m) => (
                        <li key={m.rawMaterial}>
                          {m.name}: {fmt(m.applied)} kg
                          {m.applied < m.requested && (
                            <span className="text-status-danger"> of {fmt(m.requested)} — short {fmt(m.requested - m.applied)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.forced && (
                    <div className="mt-1">
                      <StatusChip tone="danger">Forced</StatusChip>
                      {r.forceReason && <p className="mt-0.5 text-xs text-ink-600">{r.forceReason}</p>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-600">{r.reason}</td>
                <td className="px-4 py-3 text-ink-400">{r.recordedAt ? formatDate(r.recordedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
