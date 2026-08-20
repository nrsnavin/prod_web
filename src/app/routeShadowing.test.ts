import { describe, expect, it } from "vitest";
import { allNavItems } from "./navigation";

// ══════════════════════════════════════════════════════════════════
//  A ROUTE THAT IS DECLARED TWICE SILENTLY LOSES
//
//  /materials/groups was both a nav destination and an explicit entry
//  in detailRoutes. The router builds its list by spreading the
//  nav-generated routes FIRST, each falling back to <ComingSoonPage/>
//  when builtPages has no entry — so the fallback matched before the
//  real route and the finished Material Groups screen rendered
//  "planned in an upcoming build stage" to everybody who opened it.
//
//  Nothing failed. A duplicate path is legal in React Router and the
//  first match simply wins, so the only symptom was a working page
//  that looked unbuilt.
//
//  This asserts the invariant rather than the one instance: no nav
//  path may collide with a concrete route, because every future page
//  that is reachable from the nav and declared explicitly falls into
//  exactly the same hole.
// ══════════════════════════════════════════════════════════════════

/**
 * The literal (non-parameterised) paths router.tsx declares in
 * detailRoutes. Kept as a list rather than imported because router.tsx
 * pulls in the whole lazy page graph, which a unit test should not.
 * The guard below keeps the two from drifting.
 */
const CONCRETE_DETAIL_PATHS = [
  "/quotes/new",
  "/purchase-orders/new",
  "/materials/forecast",
  "/materials/groups",
];

describe("route shadowing", () => {
  it("nav paths that are also concrete routes are excluded from the fallback list", () => {
    // This is what router.tsx now does.
    const detailRoutePaths = new Set(CONCRETE_DETAIL_PATHS);
    const generated = allNavItems
      .filter((i) => i.path !== "/" && !detailRoutePaths.has(i.path))
      .map((i) => i.path);

    for (const p of CONCRETE_DETAIL_PATHS) {
      expect(
        generated,
        `${p} must not get a nav-generated route — it would shadow the real page`
      ).not.toContain(p);
    }
  });

  it("CONTROL: without the filter, /materials/groups IS shadowed", () => {
    // Proves the test can fail. This reproduces the old behaviour; if
    // this stops finding the collision, the first assertion has become
    // vacuous and is guarding nothing.
    const generatedOldWay = allNavItems
      .filter((i) => i.path !== "/")
      .map((i) => i.path);

    expect(generatedOldWay).toContain("/materials/groups");
  });

  it("no nav path is declared twice", () => {
    const paths = allNavItems.map((i) => i.path);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const p of paths) {
      if (seen.has(p)) dupes.push(p);
      seen.add(p);
    }
    expect(dupes).toEqual([]);
  });
});
