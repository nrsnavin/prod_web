import { it, expect } from "vitest";
import { dueText, span } from "./dispatchFormat";

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

it("says the deadline the way people say it", () => {
  const now = at(2026, 10, 21, 9, 30);
  expect(dueText(at(2026, 10, 21, 13, 0).toISOString(), now)).toMatch(/^by 1:00 pm today$/i);
  expect(dueText(at(2026, 10, 21, 23, 59).toISOString(), now)).toBe("by end of day today");
  expect(dueText(at(2026, 10, 22, 23, 59).toISOString(), now)).toBe("by end of day tomorrow");
  expect(dueText(at(2026, 10, 20, 19, 0).toISOString(), now)).toMatch(/^by 7:00 pm yesterday$/i);
});

it("reads a 'tomorrow' chosen yesterday as today", () => {
  const chosenYesterdayDue = at(2026, 10, 21, 23, 59);
  expect(dueText(chosenYesterdayDue.toISOString(), at(2026, 10, 21, 8, 0))).toBe("by end of day today");
});

it("writes spans short", () => {
  expect(span(45 * 60_000)).toBe("45m");
  expect(span(130 * 60_000)).toBe("2h 10m");
  expect(span(3 * 3600_000)).toBe("3h");
  expect(span(50 * 3600_000)).toBe("2d 2h");
});
