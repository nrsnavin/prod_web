import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { ExcessPlanningRow } from "./types";

// Jobs planned past what this order asked for.
//
// Its own card rather than a column on the job table: an excess is a
// decision someone made on a date and, past 20%, had to justify — and
// it is the thing that explains why this order's yarn draw exceeds its
// own lines. Buried in a row it would be read as a rounding difference.
//
// The card is absent entirely when nothing was over-planned. A section
// headed "Excess planning — none" on every order teaches people to
// stop reading it.

const FREE_EXCESS_PCT = 20;

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("en-IN");

export function OrderExcessPlanning({ rows }: { rows: ExcessPlanningRow[] }) {
  if (!rows || rows.length === 0) return null;

  const totalExcess = rows.reduce((s, r) => s + r.excessQuantity, 0);
  const beyondAllowance = rows.filter((r) => r.excessPct > FREE_EXCESS_PCT).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-status-warning" />
            Excess planning
          </h2>
          <p className="mt-0.5 text-sm text-ink-400">
            {fmt(totalExcess)} m planned over what this order asked for
            {beyondAllowance > 0
              ? ` · ${beyondAllowance} line${beyondAllowance === 1 ? "" : "s"} past the ${FREE_EXCESS_PCT}% allowance`
              : ""}
            . The extra yarn was drawn from stock when the job was raised.
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Elastic</th>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 text-right font-medium">Ordered</th>
              <th className="px-4 py-3 text-right font-medium">Planned</th>
              <th className="px-4 py-3 text-right font-medium">Excess</th>
              <th className="px-4 py-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r, i) => {
              const past = r.excessPct > FREE_EXCESS_PCT;
              return (
                <tr key={`${r.job}-${r.elastic}-${i}`} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name}</p>
                    {r.materialsDrawn.length > 0 && (
                      <p className="mt-0.5 text-xs text-ink-400">
                        Yarn drawn:{" "}
                        {r.materialsDrawn
                          .map((m) => `${m.name} ${fmt(m.quantity)} kg`)
                          .join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.jobNo}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(r.orderedQuantity)} m</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(r.plannedQuantity)} m</td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums font-medium">+{fmt(r.excessQuantity)} m</span>
                    <div className="mt-0.5">
                      <StatusChip tone={past ? "warning" : "neutral"}>
                        {fmt(r.excessPct)}%
                      </StatusChip>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {r.reason ? (
                      <span className="flex gap-1.5 text-ink-600">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
                        {r.reason}
                      </span>
                    ) : (
                      // An empty reason means the excess was inside the
                      // allowance and nobody was asked — say that, rather
                      // than leaving a blank cell that reads as missing.
                      <span className="text-ink-400">
                        Within the {FREE_EXCESS_PCT}% allowance — no reason required
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
