import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { chartTheme } from "@/core/charts/theme";
import { BreakdownRow } from "./types";

const axisStyle = { fontSize: 11, fill: chartTheme.axis };

function short(label: string): string {
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}

function Tip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload: BreakdownRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm shadow-card">
      <p className="font-medium">{row.label}</p>
      <p className="tabular-nums text-ink-600">
        Production: {row.production.toLocaleString("en-IN")} m
      </p>
      <p className="tabular-nums text-ink-600">
        Wastage: {row.wastageQty.toLocaleString("en-IN")} m ({row.wastageRate}%)
      </p>
    </div>
  );
}

export function BreakdownBarChart({ rows }: { rows: BreakdownRow[] }) {
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-400">No data to chart.</p>;
  }
  const data = rows.map((r) => ({ ...r, name: short(r.label) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} interval={0} angle={-25} textAnchor="end" height={60} />
        <YAxis tick={axisStyle} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="production" name="Production (m)" fill={chartTheme.series[0]} radius={[3, 3, 0, 0]} />
        <Bar dataKey="wastageQty" name="Wastage (m)" fill={chartTheme.status.critical} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
