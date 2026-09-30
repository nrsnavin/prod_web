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
