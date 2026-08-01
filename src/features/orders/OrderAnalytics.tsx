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
 * Visual analytics for an order.
 *
 * Both charts decompose the ORDERED quantity into three parts that add
 * up to it: packed, produced but not yet packed, and not yet produced.
 *
 * They used to stack produced against pending, which double-counts —
 * pending is ordered less packed, so metres that are produced but not
 * packed appeared in both bars and the stack ran past the ordered
 * quantity (600 produced + 600 pending on an order of 1000). Splitting
 * it this way makes the bar's length mean something: it is the order.
 *
 * Fulfilment in the centre is measured on PACKED, because that is what
 * the customer has been sent, and it is the same figure "pending" is
 * now measured against.
 */
export function OrderAnalytics({ elastics }: { elastics: OrderElasticProgress[] }) {
  if (!elastics || elastics.length === 0) return null;

  const t = elastics.reduce(
    (a, e) => ({
      ordered: a.ordered + (e.ordered || 0),
      produced: a.produced + (e.produced || 0),
      packed: a.packed + (e.packed || 0),
      pending: a.pending + Math.max(0, e.pendingDelivery || 0),
    }),
    { ordered: 0, produced: 0, packed: 0, pending: 0 },
  );

  /**
   * The three parts of an ordered quantity, guaranteed to add up to it.
   *
   * Clamped at each step: a job that recorded more packed than produced
   * is a data problem, and a negative slice would draw as a gap rather
   * than say so.
   */
  const split = (ordered: number, produced: number, packed: number) => {
    const p = Math.min(Math.max(0, packed), Math.max(0, ordered));
    const inStockNotPacked = Math.min(Math.max(0, produced - packed), Math.max(0, ordered - p));
    return {
      Packed: p,
      "Produced, not packed": inStockNotPacked,
      "Not produced": Math.max(0, ordered - p - inStockNotPacked),
    };
  };

  const totalSplit = split(t.ordered, t.produced, t.packed);
  // Fulfilment is what has been packed — the same basis pending uses.
  const pct = t.ordered > 0 ? Math.round((t.packed / t.ordered) * 100) : 0;
  const donut = Object.entries(totalSplit).map(([name, value]) => ({ name, value }));
  const donutColors = [C_PACKED, C_PRODUCED, C_PENDING];

  const bars = elastics.map((e) => ({
    name: e.name,
    ...split(e.ordered || 0, e.produced || 0, e.packed || 0),
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
              <Tooltip {...chartTheme.tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums">{pct}%</span>
            <span className="text-xs text-ink-400">packed</span>
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
        <h3 className="mb-3 font-semibold">Where each elastic stands</h3>
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
            <XAxis type="number" tick={{ fontSize: 12, fill: chartTheme.axis }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: chartTheme.axis }} />
            <Tooltip cursor={{ fill: chartTheme.cursor }} {...chartTheme.tooltip} />
            <Legend />
            {/* In the order the work happens, so the bar reads left to
                right as progress and its full length is the order. */}
            <Bar dataKey="Packed" stackId="a" fill={C_PACKED} />
            <Bar dataKey="Produced, not packed" stackId="a" fill={C_PRODUCED} />
            <Bar dataKey="Not produced" stackId="a" fill={C_PENDING} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
