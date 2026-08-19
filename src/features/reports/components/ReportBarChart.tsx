import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { chartTheme } from "@/core/charts/theme";

// ══════════════════════════════════════════════════════════════════
//  THE ONE PLACE RECHARTS IS IMPORTED BY A REPORT
//
//  All five report pages drew the same chart: one bar series over a
//  date axis, differing only in which key they plotted, which colour
//  slot they used, and how the tooltip phrased the number. Each one
//  imported recharts at the top of its own module, so 362 KB was
//  parsed and executed before any of them could draw a heading.
//
//  Collapsing them into one component is worth more than the
//  duplication it removes: recharts now has exactly one import site in
//  the reports feature, which is what makes it possible to put the
//  whole library behind a single lazy boundary (see the pages, which
//  load this through lazyChart). Five copies could not be deferred
//  without five boundaries.
//
//  ── The signed variant ───────────────────────────────────────────
//  Stock movements plot a net figure that goes both ways, so the bars
//  are coloured per point and a zero line is drawn. That is a real
//  difference in what the chart MEANS — a bar below the axis is stock
//  leaving — so it is a named mode rather than four more props.
// ══════════════════════════════════════════════════════════════════

export interface ReportBarChartProps<T> {
  series: T[];
  /** Which field to plot. The x axis is always `date`. */
  dataKey: string;
  /** Slot in the categorical palette. Ignored when `signed`. */
  colorIndex?: 0 | 1 | 2 | 3;
  /** How the tooltip says the value, e.g. `(v) => `${nf(v)} m`` */
  format: (value: number) => string;
  /**
   * Colour each bar by its sign and draw a zero line. For a net figure
   * where below the axis means something — stock leaving, not a small
   * positive.
   */
  signed?: boolean;
}

function ReportTooltip({
  active, payload, label, format,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  format: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm shadow-card">
      <p className="font-medium">{label}</p>
      <p className="tabular-nums text-ink-600">{format(payload[0].value)}</p>
    </div>
  );
}

export function ReportBarChart<T extends object>({
  series, dataKey, colorIndex = 0, format, signed,
}: ReportBarChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: chartTheme.axis }} />
        <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} />
        {signed && <ReferenceLine y={0} stroke={chartTheme.axis} />}
        <Tooltip
          content={<ReportTooltip format={format} />}
          cursor={{ fill: chartTheme.cursor }}
        />
        <Bar
          dataKey={dataKey}
          radius={[4, 4, 0, 0]}
          fill={signed ? undefined : chartTheme.series[colorIndex]}
        >
          {signed &&
            series.map((point, i) => (
              <Cell
                key={i}
                fill={
                  Number((point as Record<string, unknown>)[dataKey]) >= 0
                    ? chartTheme.series[1]
                    : chartTheme.status.critical
                }
              />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
