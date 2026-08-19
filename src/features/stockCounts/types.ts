// Mirrors models/StockCount.js and the shapes api/stockCount.js returns.
//
// The one thing worth reading twice: `countedQty` is `number | null`,
// and null means nobody has been to that rack yet. It is NOT zero.
// Every screen here has to keep those two apart, because the server
// deliberately refuses to write off a line it was never told about.

export type StockCountStatus =
  | "draft"
  | "counting"
  | "review"
  | "posted"
  | "cancelled";

export type StockCountScopeKind = "all" | "category" | "supplier" | "materials";

export interface StockCountScope {
  kind: StockCountScopeKind;
  category?: string;
  supplier?: string | { _id: string; name?: string } | null;
  materials?: string[];
}

export interface StockCountLine {
  _id: string;
  rawMaterial: string;
  name: string;
  category: string;
  /** What the system believed when the count was opened. Never refreshed. */
  systemQty: number;
  /** The cost as at the freeze — what the variance is valued at. */
  unitCost: number;
  /** null until somebody has counted it. */
  countedQty: number | null;
  /** counted − system. null while uncounted. */
  variance: number | null;
  varianceValue: number | null;
  reason: string;
  /** The server will not post this line until a reason is given. */
  needsReason: boolean;
  countedAt: string | null;
  /** Live stock at posting; null before. */
  stockAtPost: number | null;
  /** What was actually applied — less than the variance when stock hit zero. */
  appliedDelta: number | null;
  /**
   * How much of this line's discrepancy another count had already
   * corrected. Non-zero means part or all of the variance was not
   * applied because somebody else's sheet had already fixed it.
   */
  correctedElsewhere?: number;
  /** Whether the material moved while the count was open. null before posting. */
  movedSinceFreeze: boolean | null;
}

export interface StockCountTotals {
  lines: number;
  counted: number;
  uncounted: number;
  varied: number;
  needingReason: number;
  gainQuantity: number;
  lossQuantity: number;
  gainValue: number;
  lossValue: number;
  netValue: number;
}

export interface PostedSummary {
  linesCounted: number;
  linesVaried: number;
  gainQuantity: number;
  lossQuantity: number;
  gainValue: number;
  lossValue: number;
  netValue: number;
  linesMovedSinceFreeze: number;
}

export interface StockCount {
  _id: string;
  countNo: number | null;
  label: string;
  status: StockCountStatus;
  scope: StockCountScope;
  frozenAt: string;
  postedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string;
  postedSummary: PostedSummary | null;
  lines: StockCountLine[];
  totals: StockCountTotals;
}

/** The row shape the list endpoint returns — no lines, just progress. */
export interface StockCountSummary {
  _id: string;
  countNo: number | null;
  label: string;
  status: StockCountStatus;
  scope: StockCountScope;
  frozenAt: string;
  postedAt: string | null;
  lines: number;
  counted: number;
  netValue: number | null;
}

export interface VarianceReport {
  countNo: number | null;
  label: string;
  status: StockCountStatus;
  frozenAt: string;
  postedAt: string | null;
  lines: StockCountLine[];
  totals: StockCountTotals;
}

export interface CountEntry {
  rawMaterial?: string;
  lineId?: string;
  /** null clears the line back to uncounted. undefined leaves it alone. */
  countedQty?: number | null;
  reason?: string;
}

export const STATUS_TONE: Record<
  StockCountStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  draft: "neutral",
  counting: "info",
  review: "warning",
  posted: "success",
  cancelled: "neutral",
};

export const STATUS_LABEL: Record<StockCountStatus, string> = {
  draft: "Draft",
  counting: "Counting",
  review: "Review",
  posted: "Posted",
  cancelled: "Cancelled",
};
