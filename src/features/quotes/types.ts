export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export interface QuoteMaterial {
  label: string;
  weightGrams: number;
  ratePerKg: number;
  cost: number;
}

export interface QuoteLine {
  elastic?: string;
  productName: string;
  productSpec?: string;
  materials: QuoteMaterial[];
  conversionCost: number;
  marginPercent: number;
  quantityMetres: number;

  totalWeightGrams: number;
  materialCost: number;
  totalCost: number;
  marginAmount: number;
  rateBeforeTax: number;
  gstAmount: number;
  rateInclTax: number;
  valueBeforeTax: number;
  valueInclTax: number;
}

export interface Quote {
  _id: string;
  quoteNo: string;
  financialYear: string;
  sequence: number;
  date: string;
  validTill: string;

  customerName: string;
  customerAddress?: string;
  customerGstin?: string;
  customerRef?: string;

  customerPhone?: string;

  lines: QuoteLine[];

  gstPercent: number;
  subTotal: number;
  gstAmount: number;
  grandTotal: number;
  totalQuantityMetres: number;

  remarks?: string;
  status: QuoteStatus;
  createdAt?: string;
}

/** What the create/update endpoints accept. Totals are never sent — the
 *  server prices every quote from these figures itself. */
export interface QuoteWriteLine {
  elastic?: string;
  productName: string;
  productSpec?: string;
  materials: Array<{ label: string; weightGrams: number; ratePerKg: number }>;
  conversionCost: number;
  marginPercent: number;
  quantityMetres: number;
}

/** What the create/update endpoints accept. Totals are never sent — the
 *  server prices every quote from these figures itself. */
export interface QuoteWriteBody {
  /** The master record, when one was picked. Optional by design: a quote
   *  often goes to somebody who is not a customer yet. */
  customer?: string;
  customerName: string;
  customerAddress?: string;
  customerGstin?: string;
  customerPhone?: string;
  customerRef?: string;
  date?: string;
  validTill?: string;
  remarks?: string;
  lines: QuoteWriteLine[];
  gstPercent: number;
}

// ══════════════════════════════════════════════════════════════════
//  WIN / LOSS — mirrors services/quoteWinLoss.js
//
//  Read-only history. Every rate on it counts only quotes the customer
//  actually ANSWERED, and the estimator that produced it is always
//  named — a percentage with no sample size beside it is how somebody
//  talks themselves into a bad price.
// ══════════════════════════════════════════════════════════════════

export interface WinLossBand {
  band: string;
  minMarginPct: number | null;
  maxMarginPct: number | null;
  quotes: number;
  wins: number;
  /** Null when the band is empty — not zero, which would read as "never won". */
  winRatePct: number | null;
  /** Too few quotes to mean anything on its own. */
  thin: boolean;
}

export interface WinLossPoint {
  marginPct: number;
  winProbabilityPct: number;
  /** Win probability x margin. The cheapest price wins most and earns least. */
  expectedMarginPoints: number;
}

export interface QuoteWinLoss {
  success: boolean;
  quotes: number;
  wins: number;
  losses: number;
  /** Declined and expired apart: a decline is a no, an expiry may be a quote nobody chased. */
  lossBreakdown: { declined: number; expired: number };
  baselineWinRatePct: number | null;
  windowFrom: string | null;
  filters: { customerId: string | null; productName: string | null };
  /** Which estimator answered. "empirical" means observed history, not a prediction. */
  estimator: "none" | "empirical" | "logistic";
  bands: WinLossBand[];
  curve: WinLossPoint[];
  bestExpectedMarginPct?: number;
  note?: string;
}

export interface QuoteWinLossForQuote {
  success: boolean;
  quoteNo: string;
  customerName: string;
  marginPct: number | null;
  atThisPrice: WinLossPoint | null;
  overall: QuoteWinLoss;
  customer: QuoteWinLoss | null;
}
