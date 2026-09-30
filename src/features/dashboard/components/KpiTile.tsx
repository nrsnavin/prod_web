import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  to?: string;
  loading?: boolean;
  /** Paint the value in the danger color when attention is needed */
  alert?: boolean;
  footer?: ReactNode;
}

export function KpiTile({ label, value, icon: Icon, to, loading, alert, footer }: KpiTileProps) {
  const body = (
    <Card interactive={!!to} className="p-4 sm:p-5 h-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug text-ink-400">{label}</p>
        <span className="hidden sm:grid h-8 w-8 shrink-0 rounded-lg bg-ink-100 place-items-center text-ink-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-20" />
      ) : (
        <p
          className={cn(
            "mt-1 text-2xl sm:text-3xl font-bold tabular-nums",
            alert ? "text-status-danger" : "text-ink-900"
          )}
        >
          {value}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-400 min-h-[16px]">
        <span className="min-w-0 truncate">{footer}</span>
        {to && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}
