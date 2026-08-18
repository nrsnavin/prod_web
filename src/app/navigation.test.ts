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
    const user = { role: "production", department: "production", features: ["/wastage", "/orders"] };
    expect(canAccess(item("/wastage"), user)).toBe(true);
    expect(canAccess(item("/orders"), user)).toBe(true);
    expect(canAccess(item("/machines"), user)).toBe(false); // not granted
  });

  it("always allows unrestricted items regardless of the feature list", () => {
    const user = { department: "production", features: [] as string[] };
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
    const production = featuresForDepartment("production");
    expect(production).toContain("/wastage");
    expect(production).toContain("/warping"); // merged preparatory feature
    expect(production).not.toContain("/orders");
    expect(featuresForDepartment("admin")).toEqual(
      expect.arrayContaining(ALL_FEATURE_KEYS)
    );
  });

  it("legacy preparatory/weaving departments alias to production", () => {
    // Pre-merge accounts still resolve to the merged production set.
    expect(featuresForDepartment("weaving")).toEqual(featuresForDepartment("production"));
    expect(featuresForDepartment("preparatory")).toEqual(featuresForDepartment("production"));
    expect(canAccess(item("/wastage"), { department: "weaving" })).toBe(true);
    expect(canAccess(item("/warping"), { department: "preparatory" })).toBe(true);
  });

  it("exposes a non-empty grouped catalog for the checklist UI", () => {
    expect(FEATURE_GROUPS.length).toBeGreaterThan(0);
    expect(FEATURE_GROUPS.every((g) => g.features.length > 0)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
//  THE PERMISSION TRAP, NAMED IN THE CODE AND WALKED INTO ANYWAY
//
//  Adding a nav item mints a permission key, and canAccess() reads a
//  user's explicit `features` list BEFORE the admin shortcut — so a
//  brand-new key is invisible to every configured account, the owner's
//  included, until a migration grants it. The NavItem comment names
//  /quotes as the precedent. /ai-health repeated it.
//
//  A comment did not stop it happening twice. These assertions cover
//  the half that is testable from here: that a NEW account of the right
//  department is created with the key, and that it appears on the Users
//  screen so an admin can grant it to an existing one by hand. The
//  backfill for accounts that already exist is a migration, tested in
//  the backend repo.
// ══════════════════════════════════════════════════════════════════
describe("AI Health is reachable by admins", () => {
  it("is in the admin department default, so a new admin is created with it", () => {
    expect(featuresForDepartment("admin")).toContain("/ai-health");
  });

  it("is admin-only, matching the server gate on GET /health/ai", () => {
    for (const dept of ["finance", "production", "packing"]) {
      expect(featuresForDepartment(dept)).not.toContain("/ai-health");
    }
  });

  it("appears on the Users screen, so an existing admin can be granted it by hand", () => {
    // The recovery path when a migration has not been run yet. Without
    // a tickbox there is no way to fix an account at all.
    expect(ALL_FEATURE_KEYS).toContain("/ai-health");
    const admin = FEATURE_GROUPS.find((g) => g.section === "Administration");
    expect(admin?.features.map((f) => f.key)).toContain("/ai-health");
  });

  it("an admin holding the key can open the page", () => {
    const user = { role: "admin", department: "admin", features: ["/", "/ai-health"] };
    expect(canAccess(item("/ai-health"), user)).toBe(true);
    expect(canAccessPath("/ai-health", user)).toBe(true);
  });
});
