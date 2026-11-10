import { useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { cn } from "@/components/ui/cn";
import { Card } from "@/components/ui/Card";
import { chartTheme } from "@/core/charts/theme";
import { OrderElasticProgress } from "./types";

const nf = (n: number) => (n ?? 0).toLocaleString("en-IN");

// A sequence that only goes one way, so one blue that deepens as metres
// move toward the customer: produced (lightest), packed, delivered
// (darkest). What is not produced yet is the grey track the bar fills.
// They were green, blue, amber and a fourth hue, which read as four
// unrelated categories, and "Delivered" and "Not produced" could not be
// told apart in dark mode.
const C_PRODUCED = chartTheme.stage[0];
const C_PACKED = chartTheme.stage[1];
const C_DELIVERED = chartTheme.stage[2];
const C_PENDING = chartTheme.track;

const PARTS = [
  { key: "Delivered", color: C_DELIVERED },
  { key: "Packed, not delivered", color: C_PACKED },
  { key: "Produced, not packed", color: C_PRODUCED },
  { key: "Not produced", color: C_PENDING },
] as const;

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

/** The legend: a swatch for identity, the words and figures in text colour. */
function Key({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-ink-600">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
        {label}
      </span>
      {value != null && <span className="font-semibold tabular-nums text-ink-900">{nf(value)}</span>}
    </li>
  );
}

/** Chart or table: every chart can be read as figures too. */
function ViewSwitch({ view, onChange, label }: { view: "chart" | "table"; onChange: (v: "chart" | "table") => void; label: string }) {
  return (
    <div className="inline-flex rounded-lg bg-ink-100 p-0.5" role="group" aria-label={label}>
      {(["chart", "table"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
            view === v ? "bg-surface text-ink-900 shadow-card" : "text-ink-600 hover:text-ink-900"
          )}
        >
          {v}
        </button>
      ))}
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
  const [view, setView] = useState<"chart" | "table">("chart");
  if (!elastics || elastics.length === 0) return null;

  const t = elastics.reduce(
    (a, e) => ({
      ordered: a.ordered + (e.ordered || 0),
      produced: a.produced + (e.produced || 0),
      packed: a.packed + (e.packed || 0),
      delivered: a.delivered + Math.max(0, e.delivered || 0),
    }),
    { ordered: 0, produced: 0, packed: 0, delivered: 0 },
  );

  const totalSplit = splitOrdered(t.ordered, t.produced, t.packed, t.delivered);
  // Fulfilment is what the customer has actually received.
  const pct = t.ordered > 0 ? Math.round((t.delivered / t.ordered) * 100) : 0;
  const donut = PARTS.map((p) => ({ name: p.key, value: totalSplit[p.key] }));

  const bars = elastics.map((e) => ({
    name: e.name,
    ...splitOrdered(e.ordered || 0, e.produced || 0, e.packed || 0, e.delivered || 0),
  }));
  const barHeight = Math.max(160, bars.length * 40 + 40);

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Fulfilment donut and its parts */}
      <Card className="p-5">
        <h3 className="mb-1 font-semibold">Fulfilment</h3>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={donut}
                dataKey="value"
                nameKey="name"
                innerRadius={64}
                outerRadius={86}
                paddingAngle={donut.filter((d) => d.value > 0).length > 1 ? 2 : 0}
                stroke={chartTheme.surface}
                strokeWidth={2}
              >
                {donut.map((d, i) => (
                  <Cell key={d.name} fill={PARTS[i].color} />
                ))}
              </Pie>
              <Tooltip {...chartTheme.tooltip} formatter={(v) => `${nf(Number(v))} m`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums">{pct}%</span>
            <span className="text-xs text-ink-500">delivered</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-600">
          <span className="font-semibold tabular-nums text-ink-900">{nf(t.ordered)} m</span> ordered: made {nf(t.produced)}, packed {nf(t.packed)}, delivered {nf(t.delivered)}.
        </p>
        <ul className="mt-3 space-y-1.5" aria-label="Where the ordered metres are">
          {PARTS.map((p) => (
            <Key key={p.key} color={p.color} label={p.key} value={totalSplit[p.key]} />
          ))}
        </ul>
      </Card>

      {/* Per-elastic: the same four parts, each bar the length of its order */}
      <Card className="p-5 lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Where each elastic stands</h3>
          <ViewSwitch view={view} onChange={setView} label="Show as" />
        </div>
        {view === "chart" ? (
          <>
            <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Key">
              {PARTS.map((p) => (
                <Key key={p.key} color={p.color} label={p.key} />
              ))}
            </ul>
            <ResponsiveContainer width="100%" height={barHeight}>
              <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barSize={16}>
                <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                <XAxis type="number" tick={{ fontSize: 12, fill: chartTheme.axis }} tickFormatter={(v: number) => nf(v)} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: chartTheme.cursor }} {...chartTheme.tooltip} formatter={(v) => `${nf(Number(v))} m`} />
                {/* In the order the work happens, so the bar reads left to
                    right as progress and its full length is the order. */}
                {PARTS.map((p, i) => (
                  <Bar
                    key={p.key}
                    dataKey={p.key}
                    stackId="a"
                    fill={p.color}
                    stroke={chartTheme.surface}
                    strokeWidth={2}
                    radius={i === PARTS.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-table tabular-nums">
              <thead className="bg-surface-muted text-xs font-medium text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left">Elastic</th>
                  <th className="px-3 py-2 text-right">Ordered</th>
                  <th className="px-3 py-2 text-right">Made</th>
                  <th className="px-3 py-2 text-right">Packed</th>
                  <th className="px-3 py-2 text-right">Delivered</th>
                  <th className="px-3 py-2 text-right">Not produced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {elastics.map((e, i) => (
                  <tr key={e.id ?? i}>
                    <td className="px-3 py-row">{e.name}</td>
                    <td className="px-3 py-row text-right">{nf(e.ordered)}</td>
                    <td className="px-3 py-row text-right">{nf(e.produced)}</td>
                    <td className="px-3 py-row text-right">{nf(e.packed)}</td>
                    <td className="px-3 py-row text-right">{nf(Math.max(0, e.delivered || 0))}</td>
                    <td className="px-3 py-row text-right">{nf(bars[i]["Not produced"])}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-ink-200 bg-surface-muted font-semibold">
                <tr>
                  <td className="px-3 py-row text-ink-500">All, in metres</td>
                  <td className="px-3 py-row text-right">{nf(t.ordered)}</td>
                  <td className="px-3 py-row text-right">{nf(t.produced)}</td>
                  <td className="px-3 py-row text-right">{nf(t.packed)}</td>
                  <td className="px-3 py-row text-right">{nf(t.delivered)}</td>
                  <td className="px-3 py-row text-right">{nf(totalSplit["Not produced"])}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
