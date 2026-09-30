import { describe, expect, it } from "vitest";
import { change, previousPeriod } from "./comparison";

describe("previousPeriod", () => {
  it("is the same number of days, ending the day before", () => {
    expect(previousPeriod({ startDate: "2026-09-01", endDate: "2026-09-30", shift: "all" })).toEqual({
      startDate: "2026-08-02", endDate: "2026-08-31", shift: "all",
    });
  });

  it("handles a single day and a month boundary", () => {
    expect(previousPeriod({ startDate: "2026-03-01", endDate: "2026-03-01", shift: "day" })).toMatchObject({
      startDate: "2026-02-28", endDate: "2026-02-28", shift: "day",
    });
  });
});

describe("change", () => {
  it("is the rounded percentage and its direction", () => {
    expect(change(110, 100)).toEqual({ pct: 10, direction: "up" });
    expect(change(75, 100)).toEqual({ pct: -25, direction: "down" });
    expect(change(100, 100)).toEqual({ pct: 0, direction: "flat" });
  });

  it("does not compare against nothing", () => {
    expect(change(50, 0).pct).toBeNull();
    expect(change(50, undefined).pct).toBeNull();
    expect(change(undefined, 50).pct).toBeNull();
  });
});
