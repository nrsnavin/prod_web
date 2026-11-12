import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ═════════════════════════════════════════════════════════════════
//  A LINE-ITEM ROW NEVER PUSHES A PHONE'S SCREEN SIDEWAYS
//
//  The delivery challan's lines were a grid of `1fr 90px 100px 36px`.
//  A grid column of `1fr` will not shrink below its content, and the
//  searchable dropdown in it is as wide as the name picked: with a long
//  elastic name the row came to 587px on a 390px iPhone, the whole form
//  slid sideways, and Rate and Remove sat off the screen. Measured with
//  Playwright at iPhone size; the same grid was in nine more forms.
//
//  Two rules, checked here in the source (jsdom does no layout):
//
//    1. A flexible column in a written-out grid template is
//       minmax(0,1fr), which may shrink; the name then ends in "…".
//    2. The forms that were rebuilt as blocks on a phone keep their
//       phone layout: the column headings hidden below sm, the row a
//       template only from sm up.
// ═════════════════════════════════════════════════════════════════

const SRC = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [p] : [];
  });
}

describe("line-item rows on a phone", () => {
  it("never put a bare 1fr column in a grid template beside a searchable dropdown", () => {
    const offenders: string[] = [];
    for (const f of files(SRC)) {
      const text = readFileSync(f, "utf8");
      if (!/<(Async)?Combobox\b/.test(text)) continue;
      text.split("\n").forEach((line, i) => {
        // grid-cols-[1fr_…], sm:grid-cols-[…_1fr_…] and the like; minmax(0,1fr) is the fix.
        for (const m of line.matchAll(/grid-cols-\[([^\]]+)\]/g)) {
          if (m[1].split("_").includes("1fr")) offenders.push(`${relative(process.cwd(), f)}:${i + 1}  ${m[0]}`);
        }
      });
    }
    expect(offenders, `use minmax(0,1fr) so the column may shrink:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("keeps the rebuilt forms in blocks on a phone", () => {
    const rebuilt = [
      "features/deliveryChallans/DcForm.tsx",
      "features/deliveryChallans/DcEditModal.tsx",
      "features/quotes/QuoteCreatePage.tsx",
      "features/suppliers/PoDetailPage.tsx",
      "features/elastics/WarpingTemplateEditor.tsx",
      "features/warping/WarpingPlanForm.tsx",
      "features/jobs/QcPanel.tsx",
    ];
    const noHeadings = new Set(["features/elastics/WarpingTemplateEditor.tsx"]);
    for (const f of rebuilt) {
      const text = readFileSync(join(SRC, f), "utf8");
      // The headings row: hidden on a phone, a grid from sm up.
      if (!noHeadings.has(f)) expect(text, `${f}: column headings shown on a phone`).toMatch(/className="hidden grid-cols-\[minmax\(0,1fr\)[^"]*sm:grid"/);
      // The row: the table template only from sm up.
      expect(text, `${f}: the row is a table at every width`).toMatch(/sm:grid-cols-\[minmax\(0,1fr\)/);
    }
  });

  it("gives an iPhone's date field the width of its column", () => {
    const css = readFileSync(join(SRC, "index.css"), "utf8");
    const at = css.indexOf("@supports (-webkit-touch-callout: none)");
    expect(at, "the iOS date-field rule has been removed").toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("}\n}", at) + 3);
    expect(block).toMatch(/input\[type="date"\]/);
    expect(block).toMatch(/appearance:\s*none/);
    expect(block).toMatch(/min-width:\s*0/);
  });
});
