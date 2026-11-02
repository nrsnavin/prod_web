// The invoice arithmetic the form shows BEFORE the server does it for
// real — mirrors services/gst.js so the preview and the invoice agree.

import type { InvoiceDcOption, InvoiceDraftLine, InvoiceLineOverride, InvoiceTotals, SupplyType } from "./types";

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const money = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const qty = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

/** Two-digit state code off a GSTIN; "" when it is not one. */
export function stateCodeFromGstin(gstin: string | undefined): string {
  const m = /^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.exec(String(gstin || "").trim().toUpperCase());
  return m ? m[1] : "";
}

export interface PricedLine extends InvoiceDraftLine {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

/**
 * The lines an invoice would carry for the ticked challans: the
 * challans' items merged per elastic, with the rate, HSN and GST % the
 * server proposed for that elastic (or what was typed over them).
 */
export function draftLines(
  dcs: InvoiceDcOption[],
  selected: Set<string>,
  proposed: InvoiceDraftLine[],
  overrides: Record<string, InvoiceLineOverride>,
  defaults: { hsn: string; gstPercent: number }
): InvoiceDraftLine[] {
  const byElastic = new Map(proposed.map((l) => [l.elastic, l]));
  const merged = new Map<string, InvoiceDraftLine>();
  for (const dc of dcs) {
    if (!selected.has(dc._id)) continue;
    for (const item of dc.items) {
      if (!item.elastic) continue;
      const base = byElastic.get(item.elastic);
      const row = merged.get(item.elastic) ?? {
        elastic: item.elastic,
        name: base?.name || item.elasticName || "Elastic",
        unit: base?.unit || item.unit || "m",
        quantity: 0,
        rate: base?.rate ?? 0,
        hsn: base?.hsn ?? defaults.hsn,
        gstPercent: base?.gstPercent ?? defaults.gstPercent,
        dcNumbers: [],
        rateSource: base?.rateSource ?? "none",
      };
      row.quantity = Math.round((row.quantity + (Number(item.quantity) || 0)) * 1000) / 1000;
      if (!row.dcNumbers.includes(dc.dcNumber)) row.dcNumbers.push(dc.dcNumber);
      merged.set(item.elastic, row);
    }
  }
  return [...merged.values()].map((row) => {
    const o = overrides[row.elastic];
    if (!o) return row;
    return {
      ...row,
      rate: o.rate !== undefined && o.rate !== "" ? Number(o.rate) : row.rate,
      hsn: o.hsn !== undefined ? o.hsn : row.hsn,
      gstPercent: o.gstPercent !== undefined && o.gstPercent !== "" ? Number(o.gstPercent) : row.gstPercent,
      rateSource: o.rate !== undefined && o.rate !== "" ? "entered" : row.rateSource,
    };
  });
}

/** Price the lines and split the tax the way the server will. */
export function priceLines(lines: InvoiceDraftLine[], supplyType: SupplyType): { lines: PricedLine[]; totals: InvoiceTotals } {
  const inter = supplyType === "inter";
  const priced = lines.map((l) => {
    const taxable = round2(l.quantity * l.rate);
    const tax = round2((taxable * l.gstPercent) / 100);
    const half = round2(tax / 2);
    return {
      ...l,
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
  return { lines: priced, totals: { taxable, cgst, sgst, igst, tax, roundOff: round2(grand - beforeRound), grand } };
}
