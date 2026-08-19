import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ══════════════════════════════════════════════════════════════════
//  THE TOUCH-TARGET RULES, AND THE TWO WAYS THEY SILENTLY DID NOTHING
//
//  Every control in this app is sized for a mouse — 32px for the small
//  button, 40px for the standard one — against the 44px both Apple and
//  WCAG give as the minimum a finger reliably hits. On a desk that is
//  invisible; on a phone at the far end of a shed it is the difference
//  between one tap and three.
//
//  The rules were written, shipped in the bundle, and did nothing.
//  Twice, for two different reasons, and both were only found by
//  measuring in a real browser rather than reading the CSS:
//
//    1. the first version gave a min-height to checkboxes and radios
//       but never to text inputs, so the login field stayed at 40px.
//    2. the font-size rule was `input { ... }` — specificity 0,0,1 —
//       and lost to Tailwind's `.text-sm` at 0,1,0. It was present in
//       the compiled CSS and overridden every time.
//
//  Both are the same failure the rest of this audit is about: a change
//  that appears to have been made, reports no error, and has no effect.
//  These assertions are cheap insurance that neither comes back.
//
//  They check the SOURCE, not the rendering — jsdom does no layout, so
//  a real assertion about pixels is impossible here. The measurement
//  was done with Playwright at 375px; this only guards the shape of
//  the rules that measurement proved correct.
// ══════════════════════════════════════════════════════════════════

const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

/** The body of the `@media (pointer: coarse)` block. */
function coarseBlock(): string {
  const start = css.indexOf("@media (pointer: coarse)");
  expect(start, "the coarse-pointer block has been removed").toBeGreaterThan(-1);

  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return css.slice(start);
}

describe("touch targets on a phone", () => {
  const block = coarseBlock();

  it("gates on the pointer, not on a width breakpoint", () => {
    // A narrow desktop window is still driven by a mouse and should
    // stay dense; a large tablet is a finger and should not.
    expect(css).toContain("@media (pointer: coarse)");
    expect(block).not.toMatch(/max-width|min-width:\s*\d+px\)/);
  });

  it("gives text inputs a target, not only checkboxes", () => {
    // The first version missed this and the login field stayed 40px.
    expect(block).toMatch(/^\s*input,\s*$/m);
    expect(block).toMatch(/min-height:\s*44px/);
  });

  it("covers the controls somebody actually taps", () => {
    for (const selector of ["button", '[role="button"]', "a[href]", "select", "textarea"]) {
      expect(block).toContain(selector);
    }
  });

  it("leaves the checkbox itself small and grows its label", () => {
    // Growing the box would draw a 44px tick. The label around it is
    // the hit area, which is how every one of them is built here.
    expect(block).toMatch(/input\[type="checkbox"\][\s\S]*?min-height:\s*0/);
    expect(block).toMatch(/label:has\(> input\[type="checkbox"\]\)/);
  });

  it("beats Tailwind's text-size utility on specificity", () => {
    // `input { font-size: ... }` is 0,0,1 and loses to `.text-sm` at
    // 0,1,0 — it shipped and was overridden on every field. The :not()
    // takes its argument's specificity and brings this to 0,1,1.
    expect(block).toMatch(/input:not\(\[type="hidden"\]\)/);
    expect(block).toMatch(/font-size:\s*max\(16px/);
  });

  it("does not let an inline link become a 44px block", () => {
    // A link inside a sentence is not a tap target of the same kind,
    // and growing it would space the prose out.
    expect(block).toMatch(/p a\[href\]/);
  });
});

describe("the page never scrolls sideways", () => {
  it("keeps the backstop on the document itself", () => {
    // Wide content scrolls inside its own container (TableScroll).
    // This is what catches anything that slips through.
    expect(css).toMatch(/html,\s*\n?\s*body\s*\{[^}]*overflow-x:\s*hidden/);
  });
});
