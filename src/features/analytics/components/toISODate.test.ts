import { describe, it, expect } from "vitest";
import { toISODate } from "./FilterBar";

// Every caller feeds an <input type="date">, which is local by
// definition. Going through UTC made the small hours belong to the
// previous day anywhere ahead of UTC — which is where this runs.

describe("toISODate", () => {
  it("gives the local calendar date, not the UTC one", () => {
    // 02:00 local. In IST (UTC+5:30) the UTC instant is still the 31st,
    // so toISOString() would have said "2026-07-31".
    const earlyMorning = new Date(2026, 6, 15, 2, 0, 0);
    expect(toISODate(earlyMorning)).toBe("2026-07-15");
  });

  it("gives the local date late in the evening too", () => {
    // The mirror case: anywhere behind UTC, 23:00 local is already
    // tomorrow in UTC.
    const lateEvening = new Date(2026, 6, 15, 23, 30, 0);
    expect(toISODate(lateEvening)).toBe("2026-07-15");
  });

  it("pads month and day", () => {
    expect(toISODate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  it("round-trips a date the picker produced", () => {
    const iso = "2026-11-09";
    const [y, m, d] = iso.split("-").map(Number);
    expect(toISODate(new Date(y, m - 1, d))).toBe(iso);
  });
});
