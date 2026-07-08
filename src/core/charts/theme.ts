// Chart color tokens — a CVD-validated categorical palette (validated with
// the dataviz palette checker against the white card surface). Brand red is
// deliberately NOT a series color: in charts red is reserved for problem
// states, so status colors keep their meaning.
export const chartTheme = {
  // Categorical slots — assign in this fixed order, never cycled.
  series: ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7"],

  // Status colors for anomaly/health encodings (icon + label, never alone).
  status: {
    good: "#0ca30c",
    warning: "#fab219",
    serious: "#ec835a",
    critical: "#d03b3b",
  },

  grid: "#e1e0d9",
  axis: "#898781",
  ink: "#1C1C1C",
  mutedInk: "#828282",
} as const;
