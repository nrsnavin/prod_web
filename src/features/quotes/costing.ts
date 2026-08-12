// ─────────────────────────────────────────────────────────────
//  What one metre costs, computed in the browser.
//
//  This mirrors utils/quoteCosting.js on the server, deliberately and
//  exactly. The form has to price as you type — a costing sheet where
//  the total only appears after a round trip is a sheet nobody trusts —
//  but the figure that gets STORED and PRINTED is always the server's.
//  This one exists to be responsive, not to be authoritative.
//
//  Keeping the two in step is a real risk, so both are tested against
//  the same worked example: 4.2 g of yarn at ₹240/kg, plus three more
//  materials, ₹1.25 conversion, 20% margin, 5% GST → ₹4.9104/m.
// ─────────────────────────────────────────────────────────────

export interface MaterialRow {
  /** Stable key for React; not sent to the server. */
  key: string;
  label: string;
  /** Held as strings because they come from text inputs and may be "". */
  weightGrams: string;
  ratePerKg: string;
  /** The four the sheet ships with cannot be renamed, only cleared. */
  fixed?: boolean;
}

export interface CostingInput {
  materials: MaterialRow[];
  conversionCost: string;
  marginPercent: string;
  gstPercent: string;
  quantityMetres: string;
}

export interface PricedRow {
  key: string;
  label: string;
  weightGrams: number;
  ratePerKg: number;
  cost: number;
}

export interface Costing {
  rows: PricedRow[];
  totalWeightGrams: number;
  materialCost: number;
  conversionCost: number;
  totalCost: number;
  marginPercent: number;
  marginAmount: number;
  rateBeforeTax: number;
  gstPercent: number;
  gstAmount: number;
  rateInclTax: number;
  quantityMetres: number;
  valueBeforeTax: number;
  valueInclTax: number;
}

const DP = 4;

/**
 * Round, having first settled the binary representation.
 *
 * 1.005 × 3 evaluates to 3.0149999999999997; rounding that to paise
 * loses one. Settling at a precision beyond the one being kept collapses
 * the tail onto the decimal the arithmetic meant.
 */
export function roundTo(n: number, dp: number): number {
  if (!Number.isFinite(n)) return 0;
  const settled = Math.round(n * 1e9) / 1e9;
  const f = 10 ** dp;
  return Math.round(settled * f) / f;
}

const round = (n: number) => roundTo(n, DP);

/** A text field that must read as a number ≥ 0; anything else is zero. */
export function num(s: string | number | undefined): number {
  const v = typeof s === "number" ? s : parseFloat(String(s ?? "").trim());
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Cost of one material on one metre: grams ÷ 1000 × ₹/kg. */
export function rowCost(weightGrams: number, ratePerKg: number): number {
  return round((weightGrams / 1000) * ratePerKg);
}

export function priceOneMetre(input: CostingInput): Costing {
  const rows: PricedRow[] = input.materials.map((m) => {
    const weightGrams = num(m.weightGrams);
    const ratePerKg = num(m.ratePerKg);
    return {
      key: m.key,
      label: m.label.trim(),
      weightGrams,
      ratePerKg,
      cost: rowCost(weightGrams, ratePerKg),
    };
  });

  const materialCost = round(rows.reduce((s, r) => s + r.cost, 0));
  const conversionCost = round(num(input.conversionCost));
  const totalCost = round(materialCost + conversionCost);

  const marginPercent = round(num(input.marginPercent));
  const gstPercent = round(num(input.gstPercent));

  // Markup on cost — 20% on ₹100 is ₹120, not ₹125 — then rounded to
  // PAISE, because this is the number the customer is quoted.
  //
  // The costing above keeps four places: material costs are fractions of
  // a rupee and flattening them early loses real money over a long
  // order. The RATE is different — it is a commitment, printed on a
  // document somebody will multiply by their quantity. Quote 5.1504 and
  // print 5.15 and the line disagrees with its own amount by ten rupees
  // on 25,000 m. So the chain rounds once, here, and GST, the inclusive
  // rate and the extended values all come off the rounded figure.
  const rateBeforeTax = roundTo(totalCost * (1 + marginPercent / 100), 2);
  const marginAmount = roundTo(rateBeforeTax - totalCost, 2);
  const gstAmount = roundTo(rateBeforeTax * (gstPercent / 100), 2);
  const rateInclTax = roundTo(rateBeforeTax + gstAmount, 2);

  const quantityMetres = num(input.quantityMetres);

  return {
    rows,
    totalWeightGrams: round(rows.reduce((s, r) => s + r.weightGrams, 0)),
    materialCost,
    conversionCost,
    totalCost,
    marginPercent,
    marginAmount,
    rateBeforeTax,
    gstPercent,
    gstAmount,
    rateInclTax,
    quantityMetres,
    // Extended from the STORED rate, not the exact chain, so the printed
    // rate × the printed quantity equals the printed value.
    valueBeforeTax: roundTo(rateBeforeTax * quantityMetres, 2),
    valueInclTax: roundTo(rateInclTax * quantityMetres, 2),
  };
}

/** ₹ to a given number of places, grouped Indian-style. */
export function rupees(n: number, dp = 2): string {
  return (Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** The four a costing sheet always starts with, in recipe order. */
export const FIXED_ROWS = [
  "Warp yarn",
  "Spandex covering",
  "Warp spandex",
  "Weft yarn",
] as const;

let seq = 0;
export const newKey = () => `r${++seq}`;

export function startingRows(): MaterialRow[] {
  return FIXED_ROWS.map((label) => ({
    key: newKey(),
    label,
    weightGrams: "",
    ratePerKg: "",
    fixed: true,
  }));
}

// ─────────────────────────────────────────────────────────────
//  A whole quotation — several products on one document.
//
//  Mirrors priceQuote() on the server. Each product is priced on its own
//  materials, conversion cost and margin; GST is a document rate.
//
//  The rollup adds the LINE totals, each already rounded to paise, so
//  the grand total on screen is the column a reader adds by hand.
// ─────────────────────────────────────────────────────────────

export interface ProductLine {
  key: string;
  productName: string;
  productSpec: string;
  elastic?: string;
  materials: MaterialRow[];
  conversionCost: string;
  marginPercent: string;
  quantityMetres: string;
}

export interface PricedLine extends Costing {
  key: string;
  productName: string;
}

export interface QuoteCosting {
  lines: PricedLine[];
  gstPercent: number;
  subTotal: number;
  gstAmount: number;
  grandTotal: number;
  totalQuantityMetres: number;
}

export function priceQuote(
  lines: ProductLine[],
  gstPercent: string
): QuoteCosting {
  const priced: PricedLine[] = lines.map((l) => ({
    key: l.key,
    productName: l.productName,
    ...priceOneMetre({
      materials: l.materials,
      conversionCost: l.conversionCost,
      marginPercent: l.marginPercent,
      gstPercent,
      quantityMetres: l.quantityMetres,
    }),
  }));

  const sum = (pick: (l: PricedLine) => number) =>
    roundTo(priced.reduce((s, l) => s + pick(l), 0), 2);

  const subTotal = sum((l) => l.valueBeforeTax);
  const grandTotal = sum((l) => l.valueInclTax);

  return {
    lines: priced,
    gstPercent: num(gstPercent),
    subTotal,
    // Derived from the two totals rather than summed separately, so the
    // three figures on screen always agree with each other.
    gstAmount: roundTo(grandTotal - subTotal, 2),
    grandTotal,
    totalQuantityMetres: roundTo(
      priced.reduce((s, l) => s + l.quantityMetres, 0), 3
    ),
  };
}

/** A fresh product, with the four named material rows ready. */
export function newProduct(): ProductLine {
  return {
    key: newKey(),
    productName: "",
    productSpec: "",
    materials: startingRows(),
    conversionCost: "1.25",
    marginPercent: "20",
    quantityMetres: "",
  };
}
