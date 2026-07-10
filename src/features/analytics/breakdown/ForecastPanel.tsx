import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, AlertTriangle, Sparkles, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDeliveryForecast } from "./hooks";
import { BulkEta } from "./types";
import { DeliveryRiskAlerts } from "./DeliveryRiskAlerts";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Confidence follows the rate source: a per-(elastic,machine) posterior
// is a measured rate; plant/cold-start are progressively coarser priors.
function confidence(eta: BulkEta): { label: string; tone: "success" | "warning" | "neutral" } {
  const s = eta.rateSources;
  if (!s) return { label: "—", tone: "neutral" };
  const total = s.posterior + s.plant + s.coldstart + s.missing;
  if (total === 0) return { label: "—", tone: "neutral" };
  if (s.posterior / total >= 0.5) return { label: "High", tone: "success" };
  if (s.coldstart / total >= 0.5) return { label: "Low", tone: "warning" };
  return { label: "Medium", tone: "neutral" };
}

export function ForecastPanel() {
  const { orders, etas } = useDeliveryForecast();
  const loading = orders.isLoading || (orders.data && orders.data.length > 0 && etas.isLoading);

  const rows = useMemo(() => {
    const list = orders.data ?? [];
    const etaMap = etas.data ?? {};
    return list
      .map((o) => ({ order: o, eta: etaMap[o._id] }))
      .sort((a, b) => {
        // Late orders first, then earliest expected date.
        const al = a.eta?.late ? 0 : 1;
        const bl = b.eta?.late ? 0 : 1;
        if (al !== bl) return al - bl;
        const ad = a.eta?.expectedDate ? new Date(a.eta.expectedDate).getTime() : Infinity;
        const bd = b.eta?.expectedDate ? new Date(b.eta.expectedDate).getTime() : Infinity;
        return ad - bd;
      });
  }, [orders.data, etas.data]);

  const lateCount = rows.filter((r) => r.eta?.late).length;

  if (orders.isError) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        Couldn't load orders: {(orders.error as Error).message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <DeliveryRiskAlerts />

      <Card className="flex items-start gap-3 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <div>
          <p className="text-sm font-medium text-ink-900">AI-predicted delivery dates</p>
          <p className="mt-0.5 text-sm text-ink-600">
            Completion forecast for in-flight orders, learned from each machine's measured
            production rate on the elastics it's actually running. Orders at risk of missing their
            promised supply date are flagged.
          </p>
        </div>
        {lateCount > 0 && (
          <StatusChip tone="danger" className="ml-auto">
            {lateCount} at risk
          </StatusChip>
        )}
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-400">
          No approved or in-progress orders to forecast right now.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ order, eta }) => {
            const conf = eta?.ok ? confidence(eta) : null;
            return (
              <Link key={order._id} to={`/orders/${order._id}`}>
                <Card className="flex items-center gap-4 p-4 transition-colors hover:border-brand-500">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink-900">Order #{order.orderNo}</p>
                      <StatusChip tone="neutral">{order.status}</StatusChip>
                      {eta?.late && (
                        <StatusChip tone="danger">
                          <AlertTriangle className="mr-1 inline h-3 w-3" />
                          {eta.lateWorkingDays}d late
                        </StatusChip>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-400">
                      {order.customer?.name ?? "—"}
                      {order.supplyDate && ` · promised ${fmtDate(order.supplyDate)}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1.5 text-xs text-ink-400">
                      <CalendarClock className="h-3.5 w-3.5" /> Predicted
                    </p>
                    {eta?.ok ? (
                      <p
                        className={
                          "font-semibold tabular-nums " +
                          (eta.late ? "text-status-danger" : "text-ink-900")
                        }
                      >
                        {fmtDate(eta.expectedDate)}
                      </p>
                    ) : (
                      <p className="text-sm text-ink-400">Not enough data</p>
                    )}
                  </div>

                  {conf && (
                    <div className="hidden w-20 text-right sm:block">
                      <p className="text-xs text-ink-400">Confidence</p>
                      <StatusChip tone={conf.tone}>{conf.label}</StatusChip>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
