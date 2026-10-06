import { ChipTone } from "@/components/ui/StatusChip";
import { Slip, SlipCounts, SlipEdit, SlipRow, SlipStatus } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6 Oct 2026" from "2026-10-06", without a time zone moving the day. */
export function dayLabel(dateKey: string | null): string {
  const m = dateKey?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "Day shift · 6 Oct 2026", or "Shift not known yet". */
export function shiftTitle(s: Pick<Slip, "shift" | "dateKey">): string {
  if (!s.shift || !s.dateKey) return "Shift not known yet";
  return `${s.shift === "NIGHT" ? "Night" : "Day"} shift · ${dayLabel(s.dateKey)}`;
}

export const statusLabel: Record<SlipStatus, string> = {
  received: "Waiting to be read",
  reading: "Reading…",
  ready: "To confirm",
  failed: "Needs attention",
  applied: "Saved",
  discarded: "Dropped",
};

export const statusTone: Record<SlipStatus, ChipTone> = {
  received: "neutral",
  reading: "info",
  ready: "warning",
  failed: "danger",
  applied: "success",
  discarded: "neutral",
};

/** "18 ready · 2 to check · 1 not in plan" — only the parts that are there. */
export function countsSummary(c: SlipCounts): string {
  const parts = [
    c.applied && `${c.applied} saved`,
    c.ready && `${c.ready} ready`,
    c.check && `${c.check} to check`,
    c.skip && `${c.skip} skipped`,
    c.unmatched && `${c.unmatched} not in plan`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export const DATE_FROM: Record<string, string> = {
  plan: "from the sheet's plan number",
  codes: "from the sheet's row codes",
  caption: "from the message caption",
  slip: "as written on the slip",
  "caption and slip": "from the caption and the slip",
  person: "set by hand",
};

/** The editable form of a slip's rows: clear rows ticked, the rest not. */
export function initialEdits(rows: SlipRow[]): SlipEdit[] {
  return rows.map((r) => ({
    index: r.index,
    include: r.state === "ready" && !r.applied && r.production != null,
    production: r.production ?? "",
    timer: r.timer ?? "",
    remarks: r.remarks ?? "",
  }));
}

/** Why a ticked row cannot be saved as it stands, or null. */
export function editProblem(e: SlipEdit): string | null {
  if (!e.include) return null;
  const text = String(e.production ?? "").trim();
  if (!/^\d+$/.test(text)) return "Metres must be a whole number";
  if (e.timer && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(e.timer)) return "Run time like 7:45:00";
  return null;
}

/** Rows that can still be ticked: not saved, not skipped. */
export const editable = (r: SlipRow) => !r.applied && r.state !== "skip";
