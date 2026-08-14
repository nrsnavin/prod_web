import { describe, it, expect } from "vitest";
import {
  canAccess,
  canAccessPath,
  featuresForDepartment,
  FEATURE_GROUPS,
  ALL_FEATURE_KEYS,
  allNavItems,
} from "@/app/navigation";

const quotes = allNavItems.find((i) => i.path === "/quotes")!;

describe("who can see Quotations", () => {
  it("an admin with NO explicit feature list sees it", () => {
    expect(canAccess(quotes, { role: "admin", department: "admin" } as never)).toBe(true);
  });

  it("an admin WITH a feature list that omits /quotes does NOT", () => {
    expect(
      canAccess(quotes, {
        role: "admin", department: "admin",
        features: ["/orders", "/purchase-orders"],
      } as never)
    ).toBe(false);
  });

  it("and the route itself is blocked too", () => {
    expect(
      canAccessPath("/quotes/new", {
        role: "admin", department: "admin",
        features: ["/orders"],
      } as never)
    ).toBe(false);
  });

  it("ticking it restores both", () => {
    const ctx = { role: "admin", department: "admin", features: ["/orders", "/quotes"] } as never;
    expect(canAccess(quotes, ctx)).toBe(true);
    expect(canAccessPath("/quotes/new", ctx)).toBe(true);
  });

  it("appears in the Users-page checklist so it CAN be ticked", () => {
    const all = FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key));
    expect(all).toContain("/quotes");
  });

  it("is in the department default for admin and finance", () => {
    // What the migration grants existing accounts, and what a new
    // account gets. If this is false the migration silently does
    // nothing and the screen stays invisible.
    expect(featuresForDepartment("admin")).toContain("/quotes");
    expect(featuresForDepartment("finance")).toContain("/quotes");
  });

  it("is not handed to the shop floor", () => {
    // It shows cost and margin.
    expect(featuresForDepartment("production")).not.toContain("/quotes");
    expect(featuresForDepartment("packing")).not.toContain("/quotes");
  });

  it("every nav path is a known feature key, or borrows one", () => {
    // The trap this whole file exists for: a page reachable in the
    // router but absent from the feature catalog is a page nobody can
    // be granted.
    //
    // An item may instead BORROW another item's key — Material Groups
    // is part of Raw Materials, not a permission of its own. Those must
    // name a key that really exists, or they are the same trap wearing
    // a different hat: governed by a permission nobody can hold.
    for (const item of allNavItems) {
      if (item.featureKey) {
        expect(ALL_FEATURE_KEYS).toContain(item.featureKey);
      } else {
        expect(ALL_FEATURE_KEYS).toContain(item.path);
      }
    }
  });

  it("does not offer a borrowed key as its own tickbox", () => {
    // Ticking "Material Groups" independently of "Raw Materials" would
    // be a switch that does nothing, because canAccess never reads it.
    expect(ALL_FEATURE_KEYS).not.toContain("/materials/groups");
    const everyOffered = FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key));
    expect(everyOffered).not.toContain("/materials/groups");
  });
});
