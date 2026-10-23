import { describe, expect, it } from "vitest";
import { canEnter, listOrder, readCode, shiftNow, tidyRunTime } from "./floorRules";
import type { FloorMachine } from "./types";

describe("the shift running now", () => {
  it("is the day shift between 8 am and 8 pm, the night after, and yesterday's night before 8 am", () => {
    expect(shiftNow(new Date(2026, 9, 21, 9, 0))).toEqual({ dateKey: "2026-10-21", shift: "DAY" });
    expect(shiftNow(new Date(2026, 9, 21, 19, 59))).toEqual({ dateKey: "2026-10-21", shift: "DAY" });
    expect(shiftNow(new Date(2026, 9, 21, 20, 0))).toEqual({ dateKey: "2026-10-21", shift: "NIGHT" });
    expect(shiftNow(new Date(2026, 9, 22, 3, 0))).toEqual({ dateKey: "2026-10-21", shift: "NIGHT" });
    // Across a month end too.
    expect(shiftNow(new Date(2026, 10, 1, 2, 0))).toEqual({ dateKey: "2026-10-31", shift: "NIGHT" });
  });
});

describe("reading a scanned or typed code", () => {
  it("passes a loom label, a sheet row and a typed ID through, trimmed", () => {
    expect(readCode("MACHINE|abc|L1")).toEqual({ code: "MACHINE|abc|L1" });
    expect(readCode("SHIFTROW|x|M:L1|y")).toEqual({ code: "SHIFTROW|x|M:L1|y" });
    expect(readCode("  l1 ")).toEqual({ code: "l1" });
  });
  it("refuses a job label, a web link and nothing at all, with the reason", () => {
    expect(readCode("J-12")).toMatchObject({ problem: /job label/ });
    expect(readCode("JOB|abc")).toMatchObject({ problem: /job label/ });
    expect(readCode("https://x.y/z")).toMatchObject({ problem: /web link/ });
    expect(readCode("   ")).toMatchObject({ problem: /Scan the label/ });
  });
});

describe("tidying a typed run time", () => {
  it("accepts the ways a number pad writes it", () => {
    expect(tidyRunTime("7.30")).toBe("7:30:00");
    expect(tidyRunTime("730")).toBe("7:30:00");
    expect(tidyRunTime("1130")).toBe("11:30:00");
    expect(tidyRunTime("07:05:09")).toBe("7:05:09");
    expect(tidyRunTime("7:5")).toBe("7:05:00");
    expect(tidyRunTime("")).toBe("");
  });
  it("leaves what it cannot read for the server to refuse", () => {
    expect(tidyRunTime("7h30")).toBe("7h30");
    expect(tidyRunTime("7:75")).toBe("7:75");
  });
});

const loom = (ID: string, entry: FloorMachine["entry"]): FloorMachine => ({
  id: ID, ID, manufacturer: "", hooks: 8, heads: 2, headsRunning: 2, status: "running", loading: false,
  job: null, headMap: [], detail: null, entry, why: null,
});

describe("the list", () => {
  it("can be entered when ready, not on plan, or entered and not yet verified", () => {
    expect(["ready", "unplanned", "entered"].every((e) => canEnter(loom("x", e as FloorMachine["entry"])))).toBe(true);
    expect(["free", "loading", "verified", "locked"].some((e) => canEnter(loom("x", e as FloorMachine["entry"])))).toBe(false);
  });
  it("puts what needs entering first, in loom order", () => {
    const sorted = [loom("L10", "free"), loom("L2", "entered"), loom("L9", "ready"), loom("L1", "verified"), loom("L3", "unplanned")].sort(listOrder);
    expect(sorted.map((m) => m.ID)).toEqual(["L3", "L9", "L2", "L1", "L10"]);
  });
});
