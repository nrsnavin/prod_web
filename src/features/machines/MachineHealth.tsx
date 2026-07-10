import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { machineService } from "./api";
import { HealthBand, MachineHealth } from "./types";

function usePredictiveHealth() {
  return useQuery({
    queryKey: ["machine-health"],
    queryFn: () => machineService.predictiveHealth(),
    staleTime: 60_000,
  });
}

const bandTone: Record<HealthBand, "success" | "warning" | "danger"> = {
  healthy: "success",
  watch: "warning",
  at_risk: "danger",
};
const bandLabel: Record<HealthBand, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
};
function scoreColor(score: number): string {
  if (score >= 75) return "text-status-success";
  if (score >= 50) return "text-status-warning";
  return "text-status-danger";
}

// Predicted-health banner for the Machines list — surfaces machines
// trending toward a breakdown before it happens.
export function MachineHealthBanner() {
  const navigate = useNavigate();
  const { data, isLoading } = usePredictiveHealth();

  const flagged = useMemo(
    () => (data?.machines ?? []).filter((m) => m.band !== "healthy"),
    [data]
  );

  if (isLoading) return <Skeleton className="mb-4 h-24 w-full" />;
  if (!data) return null;

  if (flagged.length === 0) {
    return (
      <Card className="mb-4 border-l-4 border-status-success p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-status-success">
          <Activity className="h-4 w-4" /> All machines healthy — no predicted issues.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-l-4 border-status-warning p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-status-warning" />
        Predicted machine health — {data.summary.atRisk} at risk, {data.summary.watch} to watch
      </p>
      <div className="mt-2 space-y-1.5">
        {flagged.slice(0, 6).map((m) => (
          <button
            key={m.machineId}
            onClick={() => navigate(`/machines/${m.machineId}`)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-100"
          >
            <span className={cn("w-9 shrink-0 text-right font-bold tabular-nums", scoreColor(m.score))}>
              {m.score}
            </span>
            <span className="w-24 shrink-0 font-medium">Machine {m.machineID}</span>
            <StatusChip tone={bandTone[m.band]}>{bandLabel[m.band]}</StatusChip>
            <span className="min-w-0 flex-1 truncate text-ink-500">
              {m.reasons.map((r) => r.label).join(" · ") || "No specific signal"}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
          </button>
        ))}
      </div>
    </Card>
  );
}

// Compact health card for a single machine's detail page.
export function MachineHealthCard({ machineId }: { machineId: string }) {
  const { data, isLoading } = usePredictiveHealth();
  const m: MachineHealth | undefined = data?.machines.find((x) => x.machineId === machineId);

  if (isLoading) return <Skeleton className="mt-4 h-32 w-full" />;
  if (!m) return null;

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4 text-brand-500" /> Predicted health
        </h3>
        <StatusChip tone={bandTone[m.band]}>{bandLabel[m.band]}</StatusChip>
      </div>

      <div className="mt-3 flex items-end gap-6">
        <div>
          <p className={cn("text-4xl font-bold tabular-nums", scoreColor(m.score))}>{m.score}</p>
          <p className="text-xs text-ink-400">health score / 100</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {m.recentAvg != null && (
            <div>
              <p className="text-xs text-ink-400">Recent avg</p>
              <p className="font-medium tabular-nums">{m.recentAvg.toLocaleString("en-IN")} m/shift</p>
            </div>
          )}
          {m.baselineAvg != null && (
            <div>
              <p className="text-xs text-ink-400">Baseline avg</p>
              <p className="font-medium tabular-nums">{m.baselineAvg.toLocaleString("en-IN")} m/shift</p>
            </div>
          )}
          <div>
            <p className="text-xs text-ink-400">Issues (30d)</p>
            <p className="font-medium tabular-nums">{m.issues30d} · {m.openIssues} open</p>
          </div>
          {m.nextServiceDate && (
            <div>
              <p className="text-xs text-ink-400">Next service</p>
              <p className="font-medium">{new Date(m.nextServiceDate).toLocaleDateString("en-IN")}</p>
            </div>
          )}
        </div>
      </div>

      {m.reasons.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {m.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  r.severity === "high" ? "bg-status-danger" : r.severity === "medium" ? "bg-status-warning" : "bg-ink-400"
                )}
              />
              <span>
                <span className="font-medium">{r.label}</span>
                <span className="text-ink-500"> — {r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-400">No risk signals — running normally.</p>
      )}
    </Card>
  );
}
