// ══════════════════════════════════════════════════════════════════
//  A FLOOR REMARK, CLASSED (services/floorRemark.js on the server):
//  the downtime it reports, the minutes when it said, and whether the
//  fitter should look.
// ══════════════════════════════════════════════════════════════════

export type RemarkKind =
  | "beam_change" | "yarn_break" | "mechanical" | "electrical" | "power_cut"
  | "no_operator" | "waiting_material" | "quality" | "other";

export interface RemarkClass {
  kind: RemarkKind;
  minutes: number | null;
  machineFault: boolean;
  summary?: string;
  /** The machine issue raised from it, once raised. */
  issue?: string | null;
}

export const REMARK_KIND: Record<RemarkKind, string> = {
  beam_change: "Beam change",
  yarn_break: "Yarn breaks",
  mechanical: "Mechanical fault",
  electrical: "Electrical fault",
  power_cut: "Power cut",
  no_operator: "No operator",
  waiting_material: "Waiting for material",
  quality: "Quality",
  other: "Remark",
};

/** "Beam change · 40 min" */
export function remarkWords(r: Pick<RemarkClass, "kind" | "minutes">): string {
  const m = r.minutes;
  const time = m == null ? "" : m >= 60 ? ` · ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : ` · ${m} min`;
  return `${REMARK_KIND[r.kind] ?? "Remark"}${time}`;
}
