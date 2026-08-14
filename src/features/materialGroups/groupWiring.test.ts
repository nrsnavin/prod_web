import { describe, it, expect } from "vitest";
import { canAccessPath } from "@/app/navigation";
import { detailRoutes } from "@/app/router";

// ══════════════════════════════════════════════════════════════════
//  THE TWO WAYS THIS SCREEN COULD SHIP INVISIBLE
//
//  Both have precedent in this codebase, which is why they are pinned
//  rather than assumed:
//
//    1. /quotes shipped behind a brand-new feature key, and canAccess()
//       reads a user's explicit `features` list BEFORE it reaches the
//       admin shortcut — so the page existed and nobody could see it
//       until a migration granted the key. Material groups deliberately
//       has NO key of its own and rides on /materials.
//
//    2. A literal path registered after a :id route is swallowed by it.
//       "/materials/groups" would render the material detail page
//       looking up a material with the id "groups".
// ══════════════════════════════════════════════════════════════════

const finance = { department: "finance", features: ["/materials"] };
const admin = { department: "admin", role: "admin" };
const production = { department: "production", features: ["/warping"] };

describe("who can open the groups screen", () => {
  it("lets in anyone who can see raw materials", () => {
    // No separate feature key, so granting Raw Materials is enough.
    expect(canAccessPath("/materials/groups", finance)).toBe(true);
  });

  it("lets an admin in", () => {
    expect(canAccessPath("/materials/groups", admin)).toBe(true);
  });

  it("keeps out someone who cannot see raw materials", () => {
    expect(canAccessPath("/materials/groups", production)).toBe(false);
  });

  it("gates it exactly as the materials list is gated", () => {
    // The two must not drift: a user who can see the list and not the
    // groups behind it gets a filter chip list they cannot explain.
    for (const user of [finance, admin, production]) {
      expect(canAccessPath("/materials/groups", user)).toBe(
        canAccessPath("/materials", user)
      );
    }
  });
});

describe("the route order", () => {
  const paths = detailRoutes.map((r) => r.path);

  it("registers the groups page", () => {
    expect(paths).toContain("/materials/groups");
  });

  it("puts it BEFORE the material-detail wildcard", () => {
    // React Router ranks static segments above dynamic ones, so this
    // would work either way — but the order is what makes it obvious,
    // and a reader moving the line should see this fail.
    expect(paths.indexOf("/materials/groups")).toBeLessThan(
      paths.indexOf("/materials/:id")
    );
  });
});
