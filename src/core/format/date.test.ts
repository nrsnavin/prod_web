import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

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
