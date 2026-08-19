import { CountEntry, StockCount } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE GUESS A COUNT ENTRY MAKES BEFORE THE SERVER ANSWERS
//
//  Extracted from the mutation rather than written inline, because the
//  arithmetic is the part that can be wrong and it deserves to be
//  tested without dragging react-query's lifecycle in behind it.
//
//  Only two derived figures are guessed — variance and its value —
//  using the same formula the server uses. Everything else is left
//  exactly as it was, and the server's own copy replaces the whole
//  sheet a moment later. Anything the client cannot know (whether a
//  line now needs a reason, what the net value comes to) is not
//  invented here.
// ══════════════════════════════════════════════════════════════════

/** The sheet as it should look the instant these counts are typed. */
export function applyCounts(sheet: StockCount, entries: CountEntry[]): StockCount {
  const edits = new Map(entries.map((e) => [e.lineId, e]));

  const lines = (sheet.lines ?? []).map((line) => {
    const edit = edits.get(line._id);
    if (!edit) return line;

    // An empty box means "nobody has been to that rack yet", which is a
    // real state and NOT a counted zero — the server refuses to write
    // those off, and the guess must not suggest otherwise.
    const countedQty = edit.countedQty ?? null;
    const variance = countedQty === null ? null : countedQty - line.systemQty;

    return {
      ...line,
      countedQty,
      variance,
      varianceValue: variance === null ? null : variance * line.unitCost,
      reason: edit.reason ?? line.reason,
    };
  });

  const counted = lines.filter((l) => l.countedQty !== null).length;

  return {
    ...sheet,
    lines,
    // The counter has to move with the rows. Leaving "3 of 200" frozen
    // while the rows fill in reads as the save not working.
    totals: { ...sheet.totals, counted, uncounted: lines.length - counted },
  };
}
