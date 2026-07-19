import { useMemo } from "react";
import { Sparkles, Cpu, CalendarClock, AlertTriangle, Info } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { SidePanel } from "@/components/ui/SidePanel";
import { cn } from "@/components/ui/cn";
import { useOrderEstimate } from "./hooks";
import { OrderDetail } from "./types";

function fmt(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// AI suggested production plan for an order: recommended machine count,
// the machines→completion trade-off, and the per-elastic split. Driven
// by the same entry-time estimator used on the create form, run against
// the order's *pending* quantities. Rendered in a right-hand SidePanel so
// it sits beside the page instead of taking the centre column; the
// estimate is only fetched once the panel is opened.
export function OrderSuggestedPlan({
  order,
  open,
  onClose,
}: {
  order: OrderDetail;
  open: boolean;
  onClose: () => void;
}) {
  const pendingLines = (order.elastics ?? [])
    .map((e) => ({ elastic: e.id, name: e.name, quantity: e.pending > 0 ? e.pending : 0 }))
    .filter((l) => l.elastic && l.quantity > 0);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of order.elastics ?? []) m.set(e.id, e.name);
    return m;
  }, [order.elastics]);

  const payload = pendingLines.length
    ? {
        elasticOrdered: pendingLines.map((l) => ({ elastic: l.elastic, quantity: l.quantity })),
        supplyDate: order.supplyDate,
      }
    : null;

  // Only hit the estimator once the panel is actually open.
  const { data, isLoading, isError } = useOrderEstimate(payload, open);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" /> Suggested plan
        </span>
      }
    >
      <p className="mb-3 text-sm text-ink-400">
        AI recommendation for the {order.elastics.reduce((s, e) => s + (e.pending > 0 ? e.pending : 0), 0).toLocaleString("en-IN")} m still pending.
      </p>

      {!pendingLines.length ? (
        <p className="text-sm text-ink-400">Nothing pending on this order — no plan needed.</p>
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data?.ok ? (
        <p className="text-sm text-ink-400">Not enough production history yet to suggest a plan.</p>
      ) : (
        <>
          {/* Headline recommendation */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg bg-canvas p-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-ink-400">
                <Cpu className="h-3.5 w-3.5" /> Recommended machines
              </p>
              <p className="text-2xl font-bold tabular-nums">{data.machines ?? "—"}</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-ink-400">
                <CalendarClock className="h-3.5 w-3.5" /> Finish by
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", data.risk?.late && "text-status-danger")}>
                {fmt(data.expectedDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Weaving effort</p>
              <p className="text-2xl font-bold tabular-nums">
                {data.machineDays ?? "—"} <span className="text-xs font-normal text-ink-400">machine-days</span>
              </p>
            </div>
            {data.risk?.late ? (
              <StatusChip tone="danger">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {data.risk.lateWorkingDays}d past supply date
              </StatusChip>
            ) : (
              order.supplyDate && <StatusChip tone="success">Meets supply date</StatusChip>
            )}
          </div>

          {/* What-if trade-off */}
          {data.whatIf && data.whatIf.length > 1 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Machines vs completion
              </p>
              <div className="overflow-x-auto rounded-lg border border-ink-100">
                <table className="w-full text-sm">
                  <thead className="bg-ink-100 text-xs uppercase text-ink-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Machines</th>
                      <th className="px-3 py-2 text-right">Working days</th>
                      <th className="px-3 py-2 text-right">Finish by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {data.whatIf.map((w) => {
                      const rec = w.machines === data.machines;
                      return (
                        <tr key={w.machines} className={cn(rec && "bg-brand-50")}>
                          <td className="px-3 py-2 font-medium">
                            {w.machines}
                            {rec && <span className="ml-2 text-xs text-brand-600">recommended</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{w.workingDays}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(w.expectedDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-elastic split */}
          {data.perLineRates && data.perLineRates.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Per-elastic
              </p>
              <ul className="space-y-1 text-sm">
                {data.perLineRates.map((r) => (
                  <li key={r.elastic} className="flex items-center justify-between">
                    <span className="text-ink-700">{nameById.get(r.elastic) ?? "Elastic"}</span>
                    <span className="tabular-nums text-ink-500">
                      {r.meters.toLocaleString("en-IN")} m · ~{Math.round(r.rate).toLocaleString("en-IN")} m/machine-day
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.assumptions && data.assumptions.length > 0 && (
            <div className="mt-4 flex gap-2 rounded-lg bg-canvas p-3 text-xs text-ink-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
              <ul className="space-y-1">
                {data.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </SidePanel>
  );
}
