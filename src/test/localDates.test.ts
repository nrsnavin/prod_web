import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════
//  NO SCREEN TAKES ITS DATE FROM toISOString
//
//  `someDate.toISOString().slice(0, 10)` is the UTC date. Twenty-two
//  forms used it for "today" (yesterday until 05:30 in India: the
//  invoice date, the order date, the day's shift plan) and three used it
//  on a local midnight, which is a day early at any hour: an employee's
//  attendance and pay ledger started on the last day of the month
//  before. `ymd` / `todayYmd` in core/format/date.ts are the local date.
//
//  The one use left is on a date the server sent: a calendar date kept
//  at UTC midnight, whose UTC date is the date.
// ══════════════════════════════════════════════════════════════════

const sources = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const ALLOWED = new Map<string, string>([
  ["/src/features/shifts/ShiftPlanDetailPage.tsx", "new Date(plan.date): the plan's date as the server keeps it"],
  ["/src/core/format/date.ts", "the comment that says why not"],
]);

describe("dates for a date input", () => {
  it("are not cut from toISOString", () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.includes(".test.") && !ALLOWED.has(path))
      .flatMap(([path, text]) =>
        text.split("\n").flatMap((line, i) =>
          /toISOString\(\)\s*\.\s*(slice|substring|substr)\(\s*0\s*,\s*10\s*\)|toISOString\(\)\s*\.\s*split\(\s*["']T["']\s*\)\s*\[\s*0\s*\]/.test(line) ? [`${path}:${i + 1}`] : []));
    expect(offenders).toEqual([]);
  });

  it("is actually reading the screens", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(400);
    expect(Object.keys(sources)).toContain("/src/features/orders/OrderForm.tsx");
  });
});
