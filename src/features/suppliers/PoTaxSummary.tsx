import { PoTax, pct } from "./poTax";

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The value of a purchase order set out the way the supplier's bill will
 * set it out: the taxable value, CGST and SGST (or IGST), any round-off,
 * and the grand total. `rate`, when every line carries the same one, is
 * printed in the labels.
 */
export function PoTaxSummary({
  tax,
  rate,
  className = "",
  grandClassName = "text-lg font-bold",
}: {
  tax: PoTax;
  rate?: number | null;
  className?: string;
  grandClassName?: string;
}) {
  const t = tax.totals;
  const half = rate != null ? ` @ ${pct(rate / 2)}` : "";
  const rows: Array<[string, number]> = tax.noGst
    ? []
    : tax.supplyType === "inter"
      ? [[`IGST${rate != null ? ` @ ${pct(rate)}` : ""}`, t.igst]]
      : [[`CGST${half}`, t.cgst], [`SGST${half}`, t.sgst]];
  return (
    <dl className={`space-y-1 text-sm ${className}`}>
      <div className="flex justify-between gap-4">
        <dt className="text-ink-400">Taxable value</dt>
        <dd className="tabular-nums">₹{inr(t.taxable)}</dd>
      </div>
      {rows.map(([label, amount]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-ink-400">{label}</dt>
          <dd className="tabular-nums">₹{inr(amount)}</dd>
        </div>
      ))}
      {tax.noGst && <p className="text-xs text-ink-500">{tax.noGst}.</p>}
      {t.roundOff !== 0 && (
        <div className="flex justify-between gap-4">
          <dt className="text-ink-400">Round off</dt>
          <dd className="tabular-nums">₹{inr(t.roundOff)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-ink-100 pt-1.5">
        <dt className="text-ink-600">Total with GST</dt>
        <dd className={`tabular-nums ${grandClassName}`}>₹{t.grand.toLocaleString("en-IN")}</dd>
      </div>
    </dl>
  );
}
