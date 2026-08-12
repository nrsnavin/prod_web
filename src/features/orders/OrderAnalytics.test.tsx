import { describe, it, expect } from "vitest";
import { splitOrdered } from "./OrderAnalytics";

// ══════════════════════════════════════════════════════════════════
//  THE FOUR PARTS OF AN ORDERED QUANTITY
//
//  Both charts on the order draw a stack whose full length IS the
//  ordered quantity. That only means something if the parts add up to
//  it exactly — a stack that overshoots is how "600 produced + 600
//  pending on an order of 1000" once drew past the end of the bar.
//
//  The parts are subtracted in sequence: delivered, then what is packed
//  but not delivered, then what is produced but not packed, then the
//  rest. Every figure it takes can be inconsistent — more packed than
//  produced, more delivered than packed — so each step is clamped, and
//  the sum is the invariant worth holding.
// ══════════════════════════════════════════════════════════════════

const sum = (s: ReturnType<typeof splitOrdered>) =>
  Object.values(s).reduce((a, b) => a + b, 0);

describe("splitOrdered", () => {
  it("splits an ordinary line into its four parts", () => {
    // 1000 ordered, 800 made, 600 boxed, 400 gone.
    expect(splitOrdered(1000, 800, 600, 400)).toEqual({
      Delivered: 400,
      "Packed, not delivered": 200,
      "Produced, not packed": 200,
      "Not produced": 200,
    });
  });

  it("always adds up to the ordered quantity", () => {
    const cases: Array<[number, number, number, number]> = [
      [1000, 800, 600, 400],
      [1000, 0, 0, 0],
      [1000, 1000, 1000, 1000],
      [1000, 500, 500, 0],
      [1000, 300, 900, 200],   // more packed than produced
      [1000, 900, 300, 800],   // more delivered than packed
      [1000, 1200, 1100, 1050],// everything over the order
      [0, 0, 0, 0],
    ];
    for (const [o, p, k, d] of cases) {
      expect(sum(splitOrdered(o, p, k, d))).toBe(Math.max(0, o));
    }
  });

  it("counts nothing as delivered before anything has gone", () => {
    expect(splitOrdered(1000, 800, 600, 0)).toMatchObject({
      Delivered: 0,
      "Packed, not delivered": 600,
    });
  });

  it("shows a fully delivered line as one whole slice", () => {
    expect(splitOrdered(1000, 1000, 1000, 1000)).toEqual({
      Delivered: 1000,
      "Packed, not delivered": 0,
      "Produced, not packed": 0,
      "Not produced": 0,
    });
  });

  it("does not let an over-despatch run past the order", () => {
    // 1200 delivered against 1000 ordered. The bar's length is the
    // order, so the slice is capped — the over-despatch is reported as
    // a number elsewhere, where it can say so in words.
    const s = splitOrdered(1000, 1000, 1000, 1200);
    expect(s.Delivered).toBe(1000);
    expect(sum(s)).toBe(1000);
  });

  it("never draws a negative slice when packed exceeds produced", () => {
    // A data problem, not a drawing problem — but a negative would
    // render as a gap and look like a rendering fault.
    const s = splitOrdered(1000, 300, 900, 200);
    for (const v of Object.values(s)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("treats an empty line as entirely unproduced", () => {
    expect(splitOrdered(500, 0, 0, 0)).toEqual({
      Delivered: 0,
      "Packed, not delivered": 0,
      "Produced, not packed": 0,
      "Not produced": 500,
    });
  });

  it("holds at zero for a line ordering nothing", () => {
    expect(sum(splitOrdered(0, 0, 0, 0))).toBe(0);
  });

  it("keeps delivered ahead of packed in the stack", () => {
    // The order of the slices is the order the work happens, so the bar
    // reads left to right as progress. Delivered goods must not be
    // counted a second time as "packed, not delivered".
    const s = splitOrdered(1000, 1000, 800, 500);
    expect(s.Delivered).toBe(500);
    expect(s["Packed, not delivered"]).toBe(300);
    expect(s["Produced, not packed"]).toBe(200);
  });
});
