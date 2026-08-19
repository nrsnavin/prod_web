// Chart color tokens — a CVD-validated categorical palette (validated with
// the dataviz palette checker against the white card surface). Brand red is
// deliberately NOT a series color: in charts red is reserved for problem
// states, so status colors keep their meaning.
//
// Each token is a `var()` reference rather than a literal hex so charts
// follow the light/dark theme. Every consumer passes these straight to a
// recharts `fill`/`stroke` prop or an inline `backgroundColor`, all of which
// resolve CSS variables at paint time — so switching theme recolours the
// charts with no re-render and no hook. The values live in src/index.css;
// the dark set is lifted in lightness to stay legible on a dark surface.
export const chartTheme = {
  // Categorical slots — assign in this fixed order, never cycled.
  series: [
    "var(--chart-series-1)",
    "var(--chart-series-2)",
    "var(--chart-series-3)",
    "var(--chart-series-4)",
  ],

  // Status colors for anomaly/health encodings (icon + label, never alone).
  status: {
    good: "var(--chart-good)",
    warning: "var(--chart-warning)",
    serious: "var(--chart-serious)",
    critical: "var(--chart-critical)",
  },

  // The chart canvas itself. Needed wherever a mark punches a hole in
  // the plot — the ring on an active point, a gap between segments —
  // because that hole has to be the colour behind it, not white.
  surface: "var(--chart-surface)",

  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  ink: "var(--chart-ink)",
  mutedInk: "var(--chart-muted-ink)",

  // Hover highlight behind the focused bar/point. A near-black wash is
  // invisible on a dark canvas, so this lightens instead when dark.
  cursor: "var(--chart-cursor)",

  // Spread onto a bare <Tooltip> to theme recharts' built-in tooltip box,
  // which is otherwise hardcoded to a white card with dark text. Charts
  // that render a custom `content` component don't need this.
  tooltip: {
    contentStyle: {
      background: "var(--chart-surface)",
      border: "1px solid var(--chart-border)",
      borderRadius: 8,
      boxShadow: "var(--shadow-card)",
      color: "var(--chart-ink)",
    },
    labelStyle: { color: "var(--chart-ink)", fontWeight: 500 },
    itemStyle: { color: "var(--chart-muted-ink)" },
  },
} as const;
