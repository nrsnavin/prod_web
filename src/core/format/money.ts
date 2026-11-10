// ══════════════════════════════════════════════════════════════════
//  ONE WAY TO WRITE MONEY AND METRES
//
//  Money was written by three helper names (money, inr, rupees) in a
//  dozen local copies, and by hundreds of direct toLocaleString calls.
//  The copies disagreed: one rounded and one didn't, one put the minus
//  inside the symbol ("₹-8,010", which reads as a typo before it reads
//  as a loss) and one outside. These are the shared forms:
//
//    rupees(12400.4)        "₹12,400"     totals and summaries
//    rupeesPrecise(16.7)    "₹16.70"      rates and per-metre figures
//    rupeesAuto(12400.5)    "₹12,400.5"   pay: paise kept, never padded
//    rupeesCompact(815000)  "₹8.15 L"     tiles, where space is short
//    metres(14000)          "14,000 m"
//
//  Indian digit grouping throughout; the sign always goes before the ₹.
//  Nothing (null, undefined, NaN) is "—": a missing figure is a gap to
//  fill, not a zero.
// ══════════════════════════════════════════════════════════════════

type Num = number | null | undefined;

const isNum = (n: Num): n is number => typeof n === "number" && Number.isFinite(n);

const signed = (n: number, body: (abs: number) => string) => `${n < 0 ? "−" : ""}₹${body(Math.abs(n))}`;

/** Whole rupees: "₹12,400", "−₹8,010". */
export const rupees = (n: Num): string =>
  isNum(n) ? signed(n, (a) => Math.round(a).toLocaleString("en-IN")) : "—";

/** Two decimals always: "₹16.70". For rates and per-metre figures. */
export const rupeesPrecise = (n: Num): string =>
  isNum(n)
    ? signed(n, (a) => a.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    : "—";

/** Up to two decimals, none added: "₹12,400", "₹12,400.5". For pay. */
export const rupeesAuto = (n: Num): string =>
  isNum(n) ? signed(n, (a) => a.toLocaleString("en-IN", { maximumFractionDigits: 2 })) : "—";

/**
 * Lakh and crore for tiles: "₹8.15 L", "₹1.20 Cr". Under a lakh the
 * figure is written in full, because "₹0.45 L" is harder to read than
 * "₹45,000".
 */
export const rupeesCompact = (n: Num): string => {
  if (!isNum(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e7) return signed(n, () => `${(a / 1e7).toFixed(2)} Cr`);
  if (a >= 1e5) return signed(n, () => `${(a / 1e5).toFixed(2)} L`);
  return rupees(n);
};

/** "14,000 m". Decimals kept as given (a short length may have them). */
export const metres = (n: Num): string => (isNum(n) ? `${n.toLocaleString("en-IN")} m` : "—");

/** A count or quantity with Indian grouping, optionally with its unit. */
export const quantity = (n: Num, unit?: string): string =>
  isNum(n) ? `${n.toLocaleString("en-IN", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}` : "—";
