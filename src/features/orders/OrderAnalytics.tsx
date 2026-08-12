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
// The one that means "gone to the customer". Distinct from packed,
// which sits beside it in both charts and is the step before.
const C_DELIVERED = chartTheme.series[2];

/**
 * The four parts of an ordered quantity, guaranteed to add up to it.
 *
 * Subtracted in sequence, so each slice is what is left after the ones
 * ahead of it, and clamped at every step. A line recording more packed
 * than produced — or more delivered than packed, which an over-despatch
 * does — is a data problem, and a negative slice would draw as a gap
 * rather than say so.
 *
 * At module scope and exported because this arithmetic is the part that
 * can be wrong. Reaching it through a rendered chart would test the
 * charting library.
 */
export function splitOrdered(
  ordered: number,
  produced: number,
  packed: number,
  delivered: number,
) {
  const cap = Math.max(0, ordered);
  const d = Math.min(Math.max(0, delivered), cap);
  const packedNotDelivered = Math.min(
    Math.max(0, packed - delivered),
    Math.max(0, cap - d),
  );
  const inStockNotPacked = Math.min(
    Math.max(0, produced - Math.max(packed, delivered)),
    Math.max(0, cap - d - packedNotDelivered),
  );
  return {
    Delivered: d,
    "Packed, not delivered": packedNotDelivered,
    "Produced, not packed": inStockNotPacked,
    "Not produced": Math.max(0, cap - d - packedNotDelivered - inStockNotPacked),
  };
}

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
 * Both charts decompose the ORDERED quantity into four parts that add
 * up to it: delivered, packed but not delivered, produced but not
 * packed, and not yet produced.
 *
 * They used to stack produced against pending, which double-counts —
 * pending is ordered less packed, so metres that are produced but not
 * packed appeared in both bars and the stack ran past the ordered
 * quantity (600 produced + 600 pending on an order of 1000). Splitting
 * it this way makes the bar's length mean something: it is the order.
 *
 * DELIVERED is the newest slice and the reason for the fourth. Packed
 * was being read as "sent", and it is not: packed is goods in a box in
 * this building, delivered is goods that left it on a note. An order
 * can be fully packed with nothing despatched, and the chart called
 * that finished.
 *
 * So fulfilment in the centre is measured on DELIVERED — what the
 * customer has actually received. The label under the number says which
 * figure it is, because the number moved.
 */
export function OrderAnalytics({ elastics }: { elastics: OrderElasticProgress[] }) {
  if (!elastics || elastics.length === 0) return null;

  const t = elastics.reduce(
    (a, e) => ({
      ordered: a.ordered + (e.ordered || 0),
      produced: a.produced + (e.produced || 0),
      packed: a.packed + (e.packed || 0),
      delivered: a.delivered + Math.max(0, e.delivered || 0),
      pending: a.pending + Math.max(0, e.pendingDelivery || 0),
    }),
    { ordered: 0, produced: 0, packed: 0, delivered: 0, pending: 0 },
  );

  const totalSplit = splitOrdered(t.ordered, t.produced, t.packed, t.delivered);
  // Fulfilment is what the customer has actually received.
  const pct = t.ordered > 0 ? Math.round((t.delivered / t.ordered) * 100) : 0;
  const donut = Object.entries(totalSplit).map(([name, value]) => ({ name, value }));
  const donutColors = [C_DELIVERED, C_PACKED, C_PRODUCED, C_PENDING];

  const bars = elastics.map((e) => ({
    name: e.name,
    ...splitOrdered(e.ordered || 0, e.produced || 0, e.packed || 0, e.delivered || 0),
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
            <span className="text-xs text-ink-400">delivered</span>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Legendish color={chartTheme.mutedInk} label="Ordered" value={t.ordered} />
          <Legendish color={C_PRODUCED} label="Produced" value={t.produced} />
          <Legendish color={C_PACKED} label="Packed" value={t.packed} />
          <Legendish color={C_DELIVERED} label="Delivered" value={t.delivered} />
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
            <Bar dataKey="Delivered" stackId="a" fill={C_DELIVERED} />
            <Bar dataKey="Packed, not delivered" stackId="a" fill={C_PACKED} />
            <Bar dataKey="Produced, not packed" stackId="a" fill={C_PRODUCED} />
            <Bar dataKey="Not produced" stackId="a" fill={C_PENDING} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
