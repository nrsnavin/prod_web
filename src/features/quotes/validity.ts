import { todayYmd } from "@/core/format/date";
import type { Quote } from "./types";

// ══════════════════════════════════════════════════════════════════
//  HAS THIS QUOTE RUN OUT?
//
//  "Valid until 30 November" is good THROUGH 30 November. The server
//  keeps that date as the day itself (its UTC midnight), which as a
//  moment is 05:30 that morning in India — so comparing it with the
//  clock called a quote lapsed for the whole of its last day. The day is
//  compared with the day.
//
//  It is asked only of a price still on offer. A quote the customer
//  accepted is owed whatever the calendar has done since; one declined
//  or withdrawn has nothing left to lapse.
//
//  The server's "expired" list filter (GET /quote/list?status=expired)
//  uses the same rule, so the Lapsed chip lists exactly the rows this
//  marks.
// ══════════════════════════════════════════════════════════════════

/** The calendar day a quote is good through, "2026-11-30"; "" when it has none. */
export function validThrough(validTill: string | undefined | null): string {
  const day = String(validTill ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

export function isLapsed(q: Pick<Quote, "status" | "validTill">, today: string = todayYmd()): boolean {
  if (q.status === "expired") return true;
  if (q.status !== "draft" && q.status !== "sent") return false;
  const last = validThrough(q.validTill);
  return last !== "" && last < today;
}
