import { describe, it, expect } from "vitest";
import { countsSummary, dayLabel, editProblem, initialEdits, shiftTitle } from "./slipText";
import { SlipRow } from "./types";

const row = (over: Partial<SlipRow>): SlipRow => ({
  index: 0, shiftDetail: "s", machineID: "M-01", machineRead: "1", code: null, operator: null, jobNo: null,
  production: 1200, timer: "7:30:00", remarks: "", confidence: 0.9, state: "ready", notes: [], expected: null,
  applied: false, appliedProduction: null, ...over,
});

describe("slip wording", () => {
  it("names the shift without a time zone moving the day", () => {
    expect(dayLabel("2026-10-06")).toBe("6 Oct 2026");
    expect(shiftTitle({ shift: "NIGHT", dateKey: "2026-10-06" })).toBe("Night shift · 6 Oct 2026");
    expect(shiftTitle({ shift: null, dateKey: null })).toBe("Shift not known yet");
  });

  it("says only the counts that are there", () => {
    expect(countsSummary({ rows: 3, ready: 2, check: 1, skip: 0, applied: 0, unmatched: 0 })).toBe("2 ready · 1 to check");
    expect(countsSummary({ rows: 0, ready: 0, check: 0, skip: 0, applied: 0, unmatched: 0 })).toBe("—");
  });
});

describe("the edit form", () => {
  it("ticks clear rows only — never a held, skipped, saved or unreadable one", () => {
    const edits = initialEdits([
      row({ index: 0 }),
      row({ index: 1, state: "check" }),
      row({ index: 2, state: "skip" }),
      row({ index: 3, applied: true }),
      row({ index: 4, production: null }),
    ]);
    expect(edits.map((e) => e.include)).toEqual([true, false, false, false, false]);
  });

  it("refuses a ticked row with bad metres or run time", () => {
    const e = { index: 0, include: true, production: "12.5", timer: "7:30:00", remarks: "" };
    expect(editProblem(e)).toMatch(/whole number/);
    expect(editProblem({ ...e, production: "1200", timer: "730" })).toMatch(/Run time/);
    expect(editProblem({ ...e, production: "1200" })).toBeNull();
    expect(editProblem({ ...e, include: false })).toBeNull();
  });
});
