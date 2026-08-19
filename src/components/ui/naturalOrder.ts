// ══════════════════════════════════════════════════════════════════
//  MACHINE ORDER, NOT DICTIONARY ORDER
//
//  Almost every identifier in this system is a word followed by a
//  number — LOOM-2, J-14, DC-0009, WB-0042, lot D-7 — and some plants
//  drop the word and just number their looms 1, 2, 10.
//
//  Compared as text, both shapes come out 1, 10, 11, 2, 3. That is not
//  an ordering anybody standing in front of the looms recognises, and
//  somebody looking for LOOM-7 in a list of twenty scans past it twice.
//
//  `numeric: true` makes the collator compare digit runs as numbers
//  while still comparing the letters around them, so COMEZ-2 stays
//  separated from LOOM-2 rather than tying on the number.
//  `sensitivity: "base"` keeps a stray lower-case entry beside its
//  siblings instead of in a block of its own.
//
//  ── Why this is shared ───────────────────────────────────────────
//  It lives here because two surfaces order the same machines: the
//  table and the floor board. A second copy of the collator options
//  would drift, and the two views disagreeing about where LOOM-10 goes
//  is worse than either being wrong on its own — a reader comparing
//  them would have to work out which one to believe.
// ══════════════════════════════════════════════════════════════════

/** One collator, reused. Constructing one per comparison is slow. */
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Compare two identifiers the way somebody on the floor would order
 * them. Nullish values sort last rather than throwing or landing first.
 */
export function naturalCompare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a ?? ""), String(b ?? ""));
}

/** Sort a copy by a derived key, in machine order. */
export function sortByNatural<T>(items: T[], key: (item: T) => unknown): T[] {
  return [...items].sort((a, b) => naturalCompare(key(a), key(b)));
}
