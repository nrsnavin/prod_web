import { cn } from "./cn";

export interface SparklineProps {
  /** Oldest first; the last value is "now". */
  values: number[];
  className?: string;
  /** What the line shows, for a screen reader: "Metres a day, last 12 days". */
  label?: string;
}

/**
 * A trend line for a number tile. The history is drawn in a quiet grey
 * with a faint wash under it, and only the latest step in series blue,
 * so the eye lands on where things are now. Stretches to its box; the
 * stroke keeps its width however wide that is.
 */
export function Sparkline({ values, className, label }: SparklineProps) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const w = 100;
  const h = 28;
  const pad = 2.5;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
  const y = (v: number) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - 2 * pad);
  const xy = pts.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const area = `M${xy.join(" L")} L${x(pts.length - 1).toFixed(2)},${h} L${x(0).toFixed(2)},${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("block h-7 w-full overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={area} className="fill-ink-300" opacity={0.12} />
      <polyline
        points={xy.slice(0, -1).join(" ")}
        fill="none"
        className="stroke-ink-300"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={xy.slice(-2).join(" ")}
        fill="none"
        stroke="var(--chart-series-1)"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
