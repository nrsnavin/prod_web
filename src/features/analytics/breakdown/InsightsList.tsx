import { Sparkles, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Insight, InsightSeverity } from "./types";

const STYLE: Record<
  InsightSeverity,
  { icon: typeof Info; ring: string; iconColor: string }
> = {
  good: { icon: TrendingUp, ring: "border-status-success/30 bg-status-successBg", iconColor: "text-status-success" },
  warn: { icon: AlertTriangle, ring: "border-status-warning/30 bg-status-warningBg", iconColor: "text-status-warning" },
  info: { icon: Info, ring: "border-ink-200 bg-canvas", iconColor: "text-ink-400" },
};

export function InsightsList({ items, loading }: { items: Insight[]; loading?: boolean }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-brand-500" /> AI insights
      </h3>
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-ink-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">No insights for this selection.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const s = STYLE[it.severity] ?? STYLE.info;
            const Icon = s.icon;
            return (
              <li key={i} className={cn("flex gap-3 rounded-lg border p-3", s.ring)}>
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconColor)} />
                <div>
                  <p className="text-sm font-medium text-ink-900">{it.title}</p>
                  <p className="mt-0.5 text-sm text-ink-600">{it.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
