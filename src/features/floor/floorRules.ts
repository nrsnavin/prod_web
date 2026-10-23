import type { EntryState, FloorMachine, Shift } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR SCREEN'S OWN RULES — pure, so each is tested on its own
// ══════════════════════════════════════════════════════════════════

/**
 * The shift running now, by the factory's clock: day 8 am to 8 pm,
 * night after, and before 8 am still the night shift OF THE DAY BEFORE
 * — the night that started yesterday evening is the one being entered.
 * The server decides the same way (services/machineLoading.js).
 */
export function shiftNow(now = new Date()): { dateKey: string; shift: Shift } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const h = now.getHours();
  if (h >= 8 && h < 20) return { dateKey: key(now), shift: "DAY" };
  if (h >= 20) return { dateKey: key(now), shift: "NIGHT" };
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return { dateKey: key(y), shift: "NIGHT" };
}

/**
 * What a scanned or typed code is, before the server is asked.
 *
 *   MACHINE|<id>|<ID>   the label on a loom → sent as it is
 *   SHIFTROW|… / FLOORROW|…  a row off a printed sheet → sent; the server finds its loom
 *   J-12 / JOB|…        a job label → refused here, with the reason
 *   anything else       a typed machine ID → sent trimmed
 */
export function readCode(raw: string): { code: string } | { problem: string } {
  const text = String(raw || "").trim();
  if (!text) return { problem: "Scan the label on the loom, or type its ID." };
  if (/^J-?\d+$/i.test(text) || /^JOB\|/i.test(text)) {
    return { problem: "That is a job label. Scan the label on the loom itself." };
  }
  if (/^https?:\/\//i.test(text)) {
    return { problem: "That QR is a web link, not a loom label." };
  }
  return { code: text };
}

/** Whether a loom can be entered now, and the words for why not. */
export function canEnter(m: FloorMachine): boolean {
  return m.entry === "ready" || m.entry === "unplanned" || m.entry === "entered";
}

export const ENTRY_LABEL: Record<EntryState, string> = {
  free: "Free",
  loading: "Loading",
  unplanned: "Not on plan",
  ready: "To enter",
  entered: "Entered",
  verified: "Verified",
  locked: "Locked",
};

/**
 * "7.30" → "7:30"; "730" → "7:30"; "07:30:00" stays. Typed on a phone's
 * number pad, a run time rarely has a colon. Hours up to 12, minutes
 * and seconds to 59; anything else comes back as typed for the server
 * to refuse with its own words.
 */
export function tidyRunTime(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  let m = t.match(/^(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?$/);
  if (!m) {
    const digits = t.match(/^(\d{3,4})$/);
    if (digits) {
      const d = digits[1].padStart(4, "0");
      m = [t, d.slice(0, 2), d.slice(2)] as unknown as RegExpMatchArray;
    }
  }
  if (!m) return t;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] != null ? Number(m[3]) : 0;
  if (mm > 59 || ss > 59) return t;
  return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** The order the list shows looms in: what needs entering first, then entered, then the rest. */
export function listOrder(a: FloorMachine, b: FloorMachine): number {
  const rank = (m: FloorMachine) =>
    m.entry === "ready" || m.entry === "unplanned" ? 0 : m.entry === "entered" ? 1 : m.entry === "verified" ? 2 : 3;
  return rank(a) - rank(b) || a.ID.localeCompare(b.ID, undefined, { numeric: true, sensitivity: "base" });
}
