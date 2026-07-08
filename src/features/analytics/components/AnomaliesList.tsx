import { AlertTriangle, AlertOctagon, Info, Cog, UserRound } from "lucide-react";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Anomaly, AnomalySeverity } from "../types";

const severityMeta: Record<
  AnomalySeverity,
  { tone: ChipTone; label: string; Icon: typeof Info }
> = {
  high: { tone: "danger", label: "High", Icon: AlertOctagon },
  medium: { tone: "warning", label: "Medium", Icon: AlertTriangle },
  low: { tone: "info", label: "Low", Icon: Info },
};

export function AnomaliesList({ items }: { items: Anomaly[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No anomalies detected"
        description="Production stayed within normal bounds for this range."
      />
    );
  }
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((a, i) => {
        const { tone, label, Icon } = severityMeta[a.severity];
        const EntityIcon = a.entityType === "machine" ? Cog : UserRound;
        return (
          <li key={`${a.entityId}-${a.date}-${a.type}-${i}`} className="flex items-start gap-3 py-3">
            <Icon
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                a.severity === "high"
                  ? "text-status-danger"
                  : a.severity === "medium"
                    ? "text-status-warning"
                    : "text-status-info"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{a.message}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
                <EntityIcon className="h-3.5 w-3.5" />
                {a.entityName} · {a.dateLabel}
              </p>
            </div>
            <StatusChip tone={tone}>{label}</StatusChip>
          </li>
        );
      })}
    </ul>
  );
}
