import { describe, it, expect } from "vitest";
import { isProductionLocked, PRODUCTION_LOCKED_STATUSES } from "./productionLock";

// Mirrors utils/productionLock.js on the server. If the two drift, the UI
// either offers a button that 409s or hides one that would have worked —
// so the pipeline is pinned explicitly on both sides.
//
// Pipeline: preparatory → weaving → finishing → checking → packing →
// completed. The lock starts at finishing, where the machine is released.

describe("isProductionLocked", () => {
  it.each(["finishing", "checking", "packing", "completed", "cancelled"])(
    "locks a %s job", (status) => {
      expect(isProductionLocked(status)).toBe(true);
    });

  it.each(["preparatory", "weaving"])("leaves a %s job open", (status) => {
    expect(isProductionLocked(status)).toBe(false);
  });

  // A row whose job could not be resolved must not be treated as locked —
  // that would hide entry for shifts that never had a job at all, which is
  // the same call the server makes.
  it("treats a missing status as open", () => {
    expect(isProductionLocked(undefined)).toBe(false);
    expect(isProductionLocked(null)).toBe(false);
    expect(isProductionLocked("")).toBe(false);
  });

  it("locks exactly the statuses the server locks", () => {
    expect([...PRODUCTION_LOCKED_STATUSES].sort()).toEqual(
      ["cancelled", "checking", "completed", "finishing", "packing"]
    );
  });
});
