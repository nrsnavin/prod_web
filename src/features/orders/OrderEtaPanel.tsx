import { useMemo } from "react";
import { CalendarClock, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";
import { useOrderEstimate } from "./hooks";

function fmt(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Compact live ETA shown while the admin is filling the order form.
export function OrderEtaPanel({
  lines,
  supplyDate,
}: {
  lines: Array<{ elastic: string; quantity: number | string }>;
  supplyDate?: string;
}) {
  const clean = lines
    .filter((l) => l.elastic && Number(l.quantity) > 0)
    .map((l) => ({ elastic: l.elastic, quantity: Number(l.quantity) }));

  // Debounce a stable serialisation so we don't call the API per keystroke.
  const key = JSON.stringify({ clean, supplyDate: supplyDate || "" });
  const debKey = useDebouncedValue(key, 500);
  const payload = useMemo(() => {
    const p = JSON.parse(debKey) as { clean: typeof clean; supplyDate: string };
    return p.clean.length ? { elasticOrdered: p.clean, supplyDate: p.supplyDate || undefined } : null;
  }, [debKey]);

  const { data, isFetching, isError } = useOrderEstimate(payload, true);

  if (!clean.length) {
    return (
      <div className="rounded-lg border border-dashed border-ink-200 bg-canvas px-4 py-3 text-sm text-ink-400">
        <Sparkles className="mr-1.5 inline h-4 w-4" />
        Add elastics with quantities to see the AI-estimated completion date.
      </div>
    );
  }

  const late = data?.ok && data.risk?.late;

  return (
    <div className="rounded-lg border border-ink-200 bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <span className="text-sm font-medium">AI completion estimate</span>
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />}
      </div>

      {isError || (data && !data.ok) ? (
        <p className="mt-1 text-sm text-ink-400">
          Not enough production history yet to estimate this order.
        </p>
      ) : data?.ok ? (
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="flex items-center gap-1 text-xs text-ink-400">
              <CalendarClock className="h-3.5 w-3.5" /> Estimated completion
            </p>
            <p className={"text-lg font-bold tabular-nums " + (late ? "text-status-danger" : "text-ink-900")}>
              {fmt(data.expectedDate)}
            </p>
            <p className="text-xs text-ink-400">
              range {fmt(data.optimistic)} – {fmt(data.pessimistic)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Working days</p>
            <p className="text-lg font-bold tabular-nums">{data.workingDays ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">On</p>
            <p className="text-lg font-bold tabular-nums">
              {data.machines ?? "—"} <span className="text-xs font-normal text-ink-400">machines</span>
            </p>
          </div>
          {late && (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-dangerBg px-2.5 py-1 text-xs font-medium text-status-danger">
              <AlertTriangle className="h-3 w-3" />
              {data.risk?.lateWorkingDays}d past supply date
            </span>
          )}
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-400">Estimating…</p>
      )}
    </div>
  );
}
