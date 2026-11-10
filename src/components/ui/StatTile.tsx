import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, LucideIcon, Minus } from "lucide-react";
import { Card } from "./Card";
import { Skeleton } from "./Skeleton";
import { Sparkline } from "./Sparkline";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  ONE NUMBER TILE
//
//  There were eighteen: a KpiTile, four StatTiles, six Tiles, five
//  Stats, a Figure and a TotalTile, each with its own sizes and none
//  able to say whether the number was better or worse than before.
//  This is the one they now share. Its contract:
//
//    label · value (+ unit) · change against a NAMED period · optional
//    trend line · optional link.
//
//  A change always says what it is compared with ("vs previous 30
//  days"); a percentage on its own invites the question "since when?".
//  Big values keep proportional figures (tabular digits look loose at
//  this size); the trend line is history in grey and now in blue.
// ══════════════════════════════════════════════════════════════════

export interface StatChange {
  /** Percent change against the comparison. Null: nothing to compare with. */
  pct: number | null;
  direction: "up" | "down" | "flat";
  /** What the value is compared with, e.g. "vs previous 30 days". */
  vs?: string;
  /** Output: up is good. Wastage, overdue: up is bad. Default true. */
  higherIsBetter?: boolean;
}

export type StatTone = "default" | "good" | "warning" | "danger" | "muted";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Shown smaller after the value: "m", "L", "of 2". */
  unit?: ReactNode;
  sub?: ReactNode;
  change?: StatChange | null;
  tone?: StatTone;
  /** A colour class for the value, for callers that already have one. */
  toneClass?: string;
  /** Oldest first; drawn as a small trend line under the value. */
  trend?: number[];
  trendLabel?: string;
  icon?: LucideIcon;
  to?: string;
  loading?: boolean;
  /** card: its own card. inset: a box inside another card. plain: no box. */
  variant?: "card" | "inset" | "plain";
  size?: "sm" | "md" | "lg";
  /** Tighter padding, for a strip of many tiles. */
  dense?: boolean;
  className?: string;
  children?: ReactNode;
}

const TONE: Record<StatTone, string> = {
  default: "text-ink-900",
  good: "text-status-success",
  warning: "text-status-warning",
  danger: "text-status-danger",
  muted: "text-ink-400",
};

const SIZE = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

/** "▲ 5.1% vs previous 30 days", coloured by whether that is good news. */
export function ChangeLine({ change }: { change: StatChange }) {
  if (change.pct === null) return null;
  const higherIsBetter = change.higherIsBetter ?? true;
  const flat = change.direction === "flat";
  const good = !flat && (change.direction === "up") === higherIsBetter;
  const Icon = flat ? Minus : change.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-xs font-medium">
      <span className={cn("inline-flex items-center gap-0.5 tabular-nums", flat ? "text-ink-400" : good ? "text-status-success" : "text-status-danger")}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{flat ? "No change" : change.direction === "up" ? "Up" : "Down"}</span>
        {Math.abs(change.pct)}%
      </span>
      {change.vs && <span className="font-normal text-ink-400">{change.vs}</span>}
    </p>
  );
}

export function StatTile({
  label,
  value,
  unit,
  sub,
  change,
  tone = "default",
  toneClass,
  trend,
  trendLabel,
  icon: Icon,
  to,
  loading,
  variant = "card",
  size = "md",
  dense,
  className,
  children,
}: StatTileProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-ink-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />}
      </div>
      {loading ? (
        <Skeleton className={cn("h-7 w-20", size === "lg" && "h-9")} />
      ) : (
        <p className={cn("font-semibold leading-tight tracking-tight", SIZE[size], toneClass ?? TONE[tone])}>
          {value}
          {unit != null && unit !== "" && (
            <span className="ml-1 text-sm font-medium tracking-normal text-ink-400">{unit}</span>
          )}
        </p>
      )}
      {!loading && change && <ChangeLine change={change} />}
      {sub && <div className="text-xs text-ink-400">{sub}</div>}
      {!loading && trend && trend.length > 1 && <Sparkline values={trend} label={trendLabel} className="mt-1" />}
      {children}
      {to && (
        <span className="mt-auto flex justify-end text-ink-300" aria-hidden>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      )}
    </>
  );

  const box =
    variant === "card" ? (
      <Card interactive={!!to} className={cn("flex h-full flex-col gap-1", dense ? "p-3" : "p-4", className)}>{inner}</Card>
    ) : (
      <div
        className={cn(
          "flex h-full flex-col gap-1",
          variant === "inset" && "rounded-lg border border-ink-100 bg-surface-muted p-3",
          className
        )}
      >
        {inner}
      </div>
    );

  return to ? (
    <Link to={to} className="block h-full rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
      {box}
    </Link>
  ) : (
    box
  );
}
