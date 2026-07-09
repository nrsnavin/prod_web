import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { chartTheme } from "@/core/charts/theme";
import { TrendPoint, WeeklyPatternPoint } from "../types";

const axisStyle = { fontSize: 12, fill: chartTheme.axis };

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-card text-sm">
      <p className="font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-ink-600 tabular-nums">
          {p.value.toLocaleString("en-IN")}
          {unit}
        </p>
      ))}
    </div>
  );
}

// Single-series line — the title names the series, so no legend box.
export function ProductionTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis
          dataKey="dateLabel"
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: chartTheme.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => v.toLocaleString("en-IN")}
        />
        <Tooltip
          content={<ChartTooltip unit=" m" />}
          cursor={{ stroke: chartTheme.axis, strokeDasharray: "3 3" }}
        />
        <Line
          type="monotone"
          dataKey="production"
          name="Production"
          stroke={chartTheme.series[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Single-series bar with 4px rounded data-ends and per-bar hover.
export function WeeklyPatternChart({ data }: { data: WeeklyPatternPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis
          dataKey="dayName"
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: chartTheme.grid }}
        />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => v.toLocaleString("en-IN")}
        />
        <Tooltip content={<ChartTooltip unit=" m avg" />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar
          dataKey="avgProduction"
          name="Avg production"
          fill={chartTheme.series[0]}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        >
          {data.map((d) => (
            <Cell key={d.dayIndex} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Day vs Night split — two segments with 2px surface gap, direct-labeled
// (values + legend text in ink; the sub-3:1 aqua slot gets its relief here).
export function DayNightSplit({ day, night }: { day: number; night: number }) {
  const total = day + night;
  const dayPct = total > 0 ? (day / total) * 100 : 50;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100 gap-[2px]">
        {total > 0 && (
          <>
            <div style={{ width: `${dayPct}%`, backgroundColor: chartTheme.series[0] }} />
            <div style={{ width: `${100 - dayPct}%`, backgroundColor: chartTheme.series[1] }} />
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartTheme.series[0] }} />
          <span className="text-ink-600">Day</span>
          <span className="font-semibold tabular-nums">{day.toLocaleString("en-IN")} m</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartTheme.series[1] }} />
          <span className="text-ink-600">Night</span>
          <span className="font-semibold tabular-nums">{night.toLocaleString("en-IN")} m</span>
        </span>
      </div>
    </div>
  );
}
