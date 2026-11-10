import type { ChipTone } from "@/components/ui/StatusChip";

/**
 * Mirrors MAX_RATE in utils/money.js on the server. Elastic sells for
 * tens of rupees a meter, so this is orders of magnitude past anything
 * real — it exists to catch a fat-fingered exponent, which would
 * otherwise multiply out to Infinity and land on the P&L as a
 * confident, meaningless figure.
 */
export const MAX_RATE = 1_000_000;

// Money and metres come from the shared formatters (sign outside the
// symbol, "—" for nothing); these names are kept for the P&L screens.
export { rupees as rupee, rupeesPrecise as rupeePrecise, metres as meters } from "@/core/format/money";

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
