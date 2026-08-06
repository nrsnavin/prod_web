import type { ChipTone } from "@/components/ui/StatusChip";

// The sign goes OUTSIDE the symbol. Formatting the raw number puts it
// inside — "₹-8,010" — which on a screen full of rupee figures reads as
// a typo before it reads as a loss.
const signed = (n: number, body: (abs: number) => string) =>
  `${n < 0 ? "−" : ""}₹${body(Math.abs(n))}`;

export const rupee = (n: number | null | undefined) =>
  n == null ? "—" : signed(n, (a) => Math.round(a).toLocaleString("en-IN"));

/** Rates and per-meter figures need the paise; totals do not. */
export const rupeePrecise = (n: number | null | undefined) =>
  n == null
    ? "—"
    : signed(n, (a) =>
        a.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      );

export const meters = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toLocaleString("en-IN")} m`;

/**
 * An order with no selling rate has an UNKNOWN margin, not a bad one.
 * Rendering null as "-100%" is how a real loss gets lost in the noise,
 * so it reads as a gap to fill instead.
 */
export const marginLabel = (pct: number | null | undefined) =>
  pct == null ? "Not priced" : `${pct > 0 ? "" : ""}${pct}%`;

export const marginTone = (pct: number | null | undefined): ChipTone => {
  if (pct == null) return "neutral";
  if (pct < 0) return "danger";
  if (pct < 10) return "warning";
  return "success";
};

export const profitTone = (profit: number, marginPct: number | null) => {
  if (marginPct == null) return "text-ink-400";
  return profit < 0 ? "text-status-danger" : "text-status-success";
};
