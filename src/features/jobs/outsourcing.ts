// Mirrors utils/outsourcingRecord.js on the server.
//
// An outsourced job runs no shifts here, so this record IS its production
// record. The server refuses the move to `finishing` until it reconciles;
// this exists so the form can show what is still missing while it is
// being filled, rather than only on the rejected status change.

export interface OutsourcingRecord {
  qtySentMeters?: number | null;
  qtyReceivedMeters?: number | null;
  efficiencyPct?: number | null;
  actualReturnDate?: string | null;
  notes?: string;
  dispatchDate?: string | null;
  expectedReturnDate?: string | null;
  rejectedMeters?: number | null;
  ratePerMeter?: number | null;
  outwardChallanNo?: string;
  inwardChallanNo?: string;
  recordedAt?: string | null;
  derived?: {
    shortfallMeters: number | null;
    derivedEfficiencyPct: number | null;
    efficiencyVariancePct: number | null;
    jobWorkCost: number | null;
    leadTimeDays: number | null;
  };
  /** What still blocks the move to finishing, as the server sees it. */
  blockers?: string[];
}

export const OUTSOURCING_REQUIRED: Array<{ key: keyof OutsourcingRecord; label: string }> = [
  { key: "qtySentMeters", label: "Quantity sent (m)" },
  { key: "qtyReceivedMeters", label: "Quantity received (m)" },
  { key: "efficiencyPct", label: "Efficiency (%)" },
  { key: "actualReturnDate", label: "Actual return date" },
  { key: "notes", label: "Notes" },
];

const isBlank = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Same rule as the server's outsourcingBlockers. */
export function outsourcingBlockers(rec?: OutsourcingRecord | null): string[] {
  const r = rec ?? {};
  const out: string[] = [];

  for (const { key, label } of OUTSOURCING_REQUIRED) {
    if (isBlank(r[key])) out.push(`${label} is required`);
  }
  const sent = Number(r.qtySentMeters);
  const recv = Number(r.qtyReceivedMeters);
  const eff = Number(r.efficiencyPct);

  if (!isBlank(r.qtySentMeters) && !(sent > 0)) out.push("Quantity sent must be greater than 0");
  if (!isBlank(r.qtyReceivedMeters) && !(recv >= 0)) out.push("Quantity received cannot be negative");
  if (!isBlank(r.efficiencyPct) && !(eff > 0 && eff <= 100)) out.push("Efficiency must be between 0 and 100");
  if (!isBlank(r.notes) && String(r.notes).trim().length < 3) out.push("Notes must be at least 3 characters");

  return out;
}

export const isOutsourcingComplete = (rec?: OutsourcingRecord | null) =>
  outsourcingBlockers(rec).length === 0;
