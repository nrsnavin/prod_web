import { describe, expect, it } from "vitest";
import {
  INTERVAL_MS,
  freshnessOf,
  refetchIntervalFor,
  refetchOnFocusFor,
} from "./queryPolicy";

const q = (...queryKey: unknown[]) => ({ queryKey });

describe("query freshness policy", () => {
  it("polls the shop floor every 10 s", () => {
    for (const key of ["dashboard", "shifts", "machines", "jobs", "attendance-active"]) {
      expect(freshnessOf([key])).toBe("live");
      expect(refetchIntervalFor(q(key))).toBe(10_000);
    }
  });

  it("never polls masters, reports or anything AI-backed", () => {
    for (const key of ["customers", "elastics", "users", "payroll", "report", "global-search"]) {
      expect(refetchIntervalFor(q(key))).toBe(false);
    }
  });

  it("does not call the language model on a timer", () => {
    // The bug this policy exists for: an open diagnosis panel inherited
    // the global 10 s interval and re-ran the model six times a minute.
    expect(refetchIntervalFor(q("machine-health-advice", "m1"))).toBe(false);
  });

  it("refreshes anything unlisted once a minute", () => {
    expect(freshnessOf(["materials", { search: "" }])).toBe("warm");
    expect(refetchIntervalFor(q("some-new-screen"))).toBe(INTERVAL_MS.warm);
    expect(INTERVAL_MS.warm).toBe(60_000);
  });

  it("reads only the first key element, and survives a non-string one", () => {
    expect(freshnessOf(["materials", "dashboard"])).toBe("warm");
    expect(freshnessOf([{ dashboard: true }])).toBe("warm");
    expect(freshnessOf([])).toBe("warm");
  });

  it("catches up on focus for everything except what is already polling fast", () => {
    expect(refetchOnFocusFor(q("dashboard"))).toBe(false);
    expect(refetchOnFocusFor(q("customers"))).toBe(true);
    expect(refetchOnFocusFor(q("materials"))).toBe(true);
  });
});
