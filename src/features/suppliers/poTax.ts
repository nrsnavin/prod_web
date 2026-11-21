// GST on a purchase order, as the form shows it BEFORE the server works
// it out for real. Mirrors prod/services/purchaseTax.js so the preview
// and the saved PO agree:
//
//   • a line's rate is its own, else its material's, else the default
//     rate in Settings → Invoice; its HSN its own, else the material's;
//   • the supplier is the seller and we are the buyer, so the supplier's
//     state against ours decides CGST + SGST or IGST;
//   • a composition dealer or an unregistered supplier charges no GST.

import { round2, stateCodeFromGstin } from "@/features/invoices/gst";
import type { DocumentSettings } from "@/features/settings/types";

export interface PoTaxTotals {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  grand: number;
}

/** What the server says a PO comes to with its GST (get-po-detail, get-pos). */
export interface PoTax {
  supplyType: "intra" | "inter";
  /** Why no GST is charged (a composition or unregistered supplier); "" when it is. */
  noGst: string;
  totals: PoTaxTotals;
}

/** A rate as typed: null when blank (not stated), else the number. */
export function rateOf(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Our state and the default rate, off the document settings. */
export function purchaseTaxSettings(doc?: Pick<DocumentSettings, "gstin" | "invoice"> | null) {
  const d = rateOf(doc?.invoice?.defaultGstPercent);
  return {
    ourState: doc?.invoice?.stateCode || stateCodeFromGstin(doc?.gstin),
    defaultGst: d ?? 5,
  };
}

/** Why a supplier charges no GST, or "" when it does. */
export function noGstReason(s?: { name?: string; gstRegistration?: string } | null): string {
  if (s?.gstRegistration === "composition") return `${s.name || "This supplier"} is a composition dealer, so no GST is charged`;
  if (s?.gstRegistration === "unregistered") return `${s.name || "This supplier"} is not registered for GST, so no GST is charged`;
  return "";
}

/** A line's rate: its own, else its material's, else the default. */
export function lineGst(line: { gstPercent?: unknown }, material: { gstPercent?: unknown } | undefined, defaultGst: number): number {
  return rateOf(line.gstPercent) ?? rateOf(material?.gstPercent) ?? defaultGst;
}

/**
 * Price the lines: each line's taxable value and tax, and the totals,
 * the grand total rounded to the rupee with the round-off shown.
 */
export function pricePoLines(
  lines: Array<{ quantity: unknown; rate: unknown; gstPercent: number }>,
  { supplierGstin, ourState, noGst }: { supplierGstin?: string; ourState: string; noGst: boolean }
) {
  const seller = stateCodeFromGstin(supplierGstin);
  const buyer = ourState || seller;
  const inter = !!seller && !!buyer && seller !== buyer;
  const priced = lines.map((l) => {
    const taxable = round2((Number(l.quantity) || 0) * (Number(l.rate) || 0));
    const tax = noGst ? 0 : round2((taxable * (Number(l.gstPercent) || 0)) / 100);
    const half = round2(tax / 2);
    return {
      gstPercent: l.gstPercent,
      taxable,
      cgst: inter ? 0 : half,
      sgst: inter ? 0 : round2(tax - half),
      igst: inter ? tax : 0,
      amount: round2(taxable + tax),
    };
  });
  const sum = (k: "taxable" | "cgst" | "sgst" | "igst") => round2(priced.reduce((a, l) => a + l[k], 0));
  const taxable = sum("taxable");
  const cgst = sum("cgst");
  const sgst = sum("sgst");
  const igst = sum("igst");
  const tax = round2(cgst + sgst + igst);
  const beforeRound = round2(taxable + tax);
  const grand = Math.round(beforeRound);
  return {
    supplyType: (inter ? "inter" : "intra") as "intra" | "inter",
    lines: priced,
    totals: { taxable, cgst, sgst, igst, tax, roundOff: round2(grand - beforeRound), grand },
  };
}

/** "5%", "2.5%": a rate as printed. */
export const pct = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

/** The one rate every taxed line carries, or null when they differ. */
export function oneRate(lines: Array<{ taxable: number; gstPercent: number }>): number | null {
  const rates = [...new Set(lines.filter((l) => l.taxable > 0).map((l) => l.gstPercent))];
  return rates.length === 1 ? rates[0] : null;
}
