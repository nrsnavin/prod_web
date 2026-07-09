import { CalendarClock, Sparkles, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRunningEta } from "./hooks";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Shows the AI-predicted completion date for an in-flight order. Renders
// nothing when the order isn't in a forecastable state.
export function OrderEtaCard({ orderId, active }: { orderId: string; active: boolean }) {
  const { data, isLoading, isError } = useRunningEta(orderId, active);
  if (!active) return null;

  return (
    <Card className="mt-4 p-5">
      <h3 className="mb-1 flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-brand-500" /> AI delivery forecast
      </h3>

      {isLoading ? (
        <Skeleton className="mt-2 h-16 w-full" />
      ) : isError ? (
        <p className="text-sm text-ink-400">Couldn't compute a forecast right now.</p>
      ) : !data?.ok ? (
        <p className="text-sm text-ink-400">
          Not enough production history yet to forecast a delivery date.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-ink-400">
                <CalendarClock className="h-3.5 w-3.5" /> Predicted completion
              </p>
              <p
                className={
                  "text-2xl font-bold tabular-nums " +
                  (data.risk?.late ? "text-status-danger" : "text-ink-900")
                }
              >
                {fmtDate(data.expectedDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Working days left</p>
              <p className="text-2xl font-bold tabular-nums">{data.workingDays ?? "—"}</p>
            </div>
            {data.risk?.late ? (
              <StatusChip tone="danger">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {data.risk.lateWorkingDays} working days past promised
              </StatusChip>
            ) : (
              data.risk && <StatusChip tone="success">On track for promised date</StatusChip>
            )}
          </div>

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
    </Card>
  );
}
