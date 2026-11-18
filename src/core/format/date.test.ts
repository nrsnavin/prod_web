import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatDate, todayYmd, ymd } from "./date";

describe("formatDate", () => {
  it("writes a date nobody can read the wrong way round", () => {
    // 10 September — the US-locale "9/10/2026" reads as 9 October in India.
    expect(formatDate(new Date(2026, 8, 10))).toBe("10 Sep 2026");
    expect(formatDate(new Date(2026, 0, 1).getTime())).toBe("1 Jan 2026");
  });

  it("accepts the ISO strings the API sends", () => {
    expect(formatDate("2026-12-25T10:00:00")).toBe("25 Dec 2026");
  });

  it("shows a dash for nothing, and for garbage instead of 'Invalid Date'", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });
});

// ══════════════════════════════════════════════════════════════════
//  The calendar date here, for a date input. In India (UTC+5:30) the
//  UTC date that toISOString gives is yesterday until 05:30, and for a
//  local midnight it is always the day before.
// ══════════════════════════════════════════════════════════════════
describe("ymd, in India", () => {
  const zone = process.env.TZ;
  beforeAll(() => { process.env.TZ = "Asia/Kolkata"; });
  afterAll(() => { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; vi.useRealTimers(); });

  it("is the local day, where toISOString gave the one before", () => {
    // The first of November, as a month's start is built.
    const first = new Date(2026, 10, 1);
    expect(first.toISOString().slice(0, 10)).toBe("2026-10-31"); // what the screens used
    expect(ymd(first)).toBe("2026-11-01");
    expect(ymd(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("today is today at two in the morning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T20:30:00Z")); // 02:00 on the 18th in India
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(todayYmd()).toBe("2026-11-18");
    vi.useRealTimers();
  });
});
