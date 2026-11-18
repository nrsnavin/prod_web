// ══════════════════════════════════════════════════════════════════
//  ONE WAY TO WRITE A DATE
//
//  51 screens and printouts wrote dates with `toLocaleDateString()`,
//  which uses whatever locale the browser happens to have. On a PC set
//  to US English, 10 September came out as "9/10/2026" — which anybody
//  in India reads as 9 October. On a delivery challan or a supply-by
//  date that is not a cosmetic problem.
//
//  "10 Sep 2026" cannot be misread in any locale. Built from fixed
//  month names rather than Intl, because engines disagree on the
//  abbreviation ("Sep" / "Sept") and a printed document should not
//  depend on which browser printed it.
// ══════════════════════════════════════════════════════════════════

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "10 Sep 2026", in the viewer's local time; "—" for nothing or garbage. */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * "2026-11-18" of a date as the calendar here reads it: what a date
 * input holds, and what the server takes as a day.
 *
 * `toISOString().slice(0, 10)` looks the same and is the UTC date.
 * Before 05:30 in India that is yesterday, so a form opened early in
 * the morning defaulted to the day before (and a `max=today` would not
 * let today be picked). For a local midnight — the first of a month,
 * built with `new Date(y, m, 1)` — it is always the day before.
 */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today, as a date input holds it. */
export function todayYmd(): string {
  return ymd(new Date());
}
