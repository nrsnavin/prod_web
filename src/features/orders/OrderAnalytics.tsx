import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { chartTheme } from "@/core/charts/theme";
import { OrderElasticProgress } from "./types";

const nf = (n: number) => (n ?? 0).toLocaleString("en-IN");

const C_PRODUCED = chartTheme.status.good;    // green
const C_PACKED = chartTheme.series[0];        // blue
const C_PENDING = chartTheme.status.warning;  // amber

function Legendish({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-ink-600">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{nf(value)}</span>
    </div>
  );
}

/**
 * Visual analytics for an order: a fulfillment donut (produced vs
 * pending, % complete in the centre) plus a per-elastic stacked bar of
 * produced vs pending. Reads the order's elastic progress rows —
 * no extra API call.
 */
export function OrderAnalytics({ elastics }: { elastics: OrderElasticProgress[] }) {
  if (!elastics || elastics.length === 0) return null;

  const t = elastics.reduce(
    (a, e) => ({
      ordered: a.ordered + (e.ordered || 0),
      produced: a.produced + (e.produced || 0),
      packed: a.packed + (e.packed || 0),
      pending: a.pending + Math.max(0, e.pending || 0),
    }),
    { ordered: 0, produced: 0, packed: 0, pending: 0 },
  );

  const pct = t.ordered > 0 ? Math.round((t.produced / t.ordered) * 100) : 0;
  const donut = [
    { name: "Produced", value: t.produced },
    { name: "Pending", value: Math.max(0, t.pending) },
  ];
  const donutColors = [C_PRODUCED, C_PENDING];

  const bars = elastics.map((e) => ({
    name: e.name,
    Produced: e.produced || 0,
    Pending: Math.max(0, e.pending || 0),
  }));
  const barHeight = Math.max(200, bars.length * 46 + 40);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      {/* Fulfillment donut + totals */}
      <Card className="p-5">
        <h3 className="mb-1 font-semibold">Fulfillment</h3>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={donut}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={donut.every((d) => d.value === 0) ? 0 : 2}
                stroke="none"
              >
                {donut.map((_, i) => (
                  <Cell key={i} fill={donutColors[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums">{pct}%</span>
            <span className="text-xs text-ink-400">produced</span>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Legendish color={chartTheme.mutedInk} label="Ordered" value={t.ordered} />
          <Legendish color={C_PRODUCED} label="Produced" value={t.produced} />
          <Legendish color={C_PACKED} label="Packed" value={t.packed} />
          <Legendish color={C_PENDING} label="Pending" value={t.pending} />
        </div>
      </Card>

      {/* Per-elastic produced vs pending */}
      <Card className="p-5 lg:col-span-2">
        <h3 className="mb-3 font-semibold">Produced vs pending by elastic</h3>
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
            <XAxis type="number" tick={{ fontSize: 12, fill: chartTheme.axis }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: chartTheme.axis }} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Legend />
            <Bar dataKey="Produced" stackId="a" fill={C_PRODUCED} />
            <Bar dataKey="Pending" stackId="a" fill={C_PENDING} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
