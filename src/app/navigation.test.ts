import { describe, it, expect } from "vitest";
import {
  allNavItems,
  canAccess,
  canAccessPath,
  featuresForDepartment,
  FEATURE_GROUPS,
  ALL_FEATURE_KEYS,
} from "./navigation";

const item = (path: string) => allNavItems.find((i) => i.path === path)!;

describe("navigation access — custom per-user features", () => {
  it("grants only the features in a user's explicit list", () => {
    const user = { role: "production", department: "weaving", features: ["/wastage", "/orders"] };
    expect(canAccess(item("/wastage"), user)).toBe(true);
    expect(canAccess(item("/orders"), user)).toBe(true);
    expect(canAccess(item("/machines"), user)).toBe(false); // not granted
  });

  it("always allows unrestricted items regardless of the feature list", () => {
    const user = { department: "weaving", features: [] as string[] };
    // Dashboard / Ask Jarvis have no `departments` → always visible.
    expect(canAccess(item("/"), user)).toBe(true);
    expect(canAccess(item("/assistant"), user)).toBe(true);
    // But a gated item with an empty list is hidden.
    expect(canAccess(item("/orders"), user)).toBe(false);
  });

  it("falls back to department when the user has no features array (legacy)", () => {
    const legacy = { role: "accounts", department: "finance" }; // no `features`
    expect(canAccess(item("/orders"), legacy)).toBe(true); // finance default
    expect(canAccess(item("/warping"), legacy)).toBe(false); // not finance
  });

  it("admin department (legacy, no features) sees everything", () => {
    const admin = { role: "admin", department: "admin" };
    for (const key of ALL_FEATURE_KEYS) {
      expect(canAccess(item(key), admin)).toBe(true);
    }
  });

  it("canAccessPath honors the feature list for detail routes", () => {
    const user = { department: "finance", features: ["/orders"] };
    expect(canAccessPath("/orders/123", user)).toBe(true); // inherits /orders
    expect(canAccessPath("/machines/9", user)).toBe(false);
  });

  it("featuresForDepartment seeds the department default", () => {
    const weaving = featuresForDepartment("weaving");
    expect(weaving).toContain("/wastage");
    expect(weaving).not.toContain("/orders");
    expect(featuresForDepartment("admin")).toEqual(
      expect.arrayContaining(ALL_FEATURE_KEYS)
    );
  });

  it("exposes a non-empty grouped catalog for the checklist UI", () => {
    expect(FEATURE_GROUPS.length).toBeGreaterThan(0);
    expect(FEATURE_GROUPS.every((g) => g.features.length > 0)).toBe(true);
  });
});
