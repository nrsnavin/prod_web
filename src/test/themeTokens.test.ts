import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ══════════════════════════════════════════════════════════════════
//  COLOURS THAT ONLY EXIST IN ONE THEME
//
//  This app is themed with CSS variables: `surface` is the raised
//  sheet, `ink-*` runs dark→light and INVERTS in dark, `status-*` are
//  tuned to stay legible as text on either ground. Every one of them
//  changes value when the theme does.
//
//  A raw Tailwind palette class does not. `bg-white` is white in dark
//  mode too, and `text-emerald-600` is a mid-green picked against a
//  white page. Both compile, both look right in the only theme the
//  author had open, and neither reports anything.
//
//  That is exactly how it got in: the stock ledger's summary strip
//  shipped with `bg-white` and two palette greens, and in dark mode it
//  was a white slab with near-white numbers on it — reported from the
//  app, not from any test. The rest of the codebase was already clean,
//  which is the whole reason this guard is cheap: there is nothing to
//  grandfather except a handful of genuinely white surfaces.
//
//  This reads the SOURCE. jsdom does no layout and computes no theme,
//  so an assertion about contrast is impossible here — what is checked
//  is that a component cannot name a colour the theme has no say over.
// ══════════════════════════════════════════════════════════════════

const SRC = join(process.cwd(), "src");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (name.endsWith(".tsx") && !name.includes(".test.")) out.push(full);
  }
  return out;
}

/**
 * Strip comments before scanning.
 *
 * Not a nicety: the fix for this very bug carries a comment explaining
 * why the strip is not `bg-white`, and a guard that reads prose flagged
 * its own explanation. A rule that cannot be written about is a rule
 * people delete.
 *
 * `//` preceded by a colon is left alone so a URL in a string does not
 * take the rest of its line with it — the failure mode that matters
 * here is a line silently dropped from the scan, not one kept.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const FILES = tsxFiles(SRC).map((f) => ({
  path: relative(SRC, f),
  text: stripComments(readFileSync(f, "utf8")),
}));

/**
 * Tailwind's stock palette. Deliberately not `brand`, `ink`, `status`,
 * `surface` or `canvas` — those are this app's tokens and are the
 * point.
 */
const PALETTE =
  "red|green|blue|amber|emerald|rose|slate|gray|zinc|yellow|orange|" +
  "teal|cyan|indigo|violet|purple|pink|lime|sky|stone|neutral";

const PALETTE_CLASS = new RegExp(
  `\\b(?:bg|text|border|ring|divide|from|via|to)-(?:${PALETTE})-\\d{2,3}\\b`,
  "g"
);

/**
 * Surfaces that are white because the THING is white, not because the
 * page happens to be. Paper does not have a dark mode.
 */
const WHITE_IS_CORRECT = new Set([
  "features/jobs/JobQrPrint.tsx",       // a printed label, on paper
  "features/pdfTemplates/PdfDesignerPage.tsx", // a page preview, on paper
  "features/auth/AuthLayout.tsx",       // bg-white/15, a tint over a solid brand panel
]);

describe("colours a theme switch cannot reach", () => {
  it("no component names a stock Tailwind palette colour", () => {
    const offenders = FILES.flatMap(({ path, text }) => {
      const hits = text.match(PALETTE_CLASS) ?? [];
      return hits.map((h) => `${path}: ${h}`);
    });

    // Listed in full rather than counted: a bare number tells whoever
    // broke this nothing about where to look.
    expect(offenders).toEqual([]);
  });

  it("no component paints a surface bare white", () => {
    // `text-white` is fine and common — it is ink ON a solid colour,
    // and the solid carries the theme. A white BACKGROUND is the one
    // that strands dark text on a dark page.
    const offenders = FILES.filter(({ path }) => !WHITE_IS_CORRECT.has(path))
      .flatMap(({ path, text }) => {
        const hits = text.match(/\bbg-white\b/g) ?? [];
        return hits.map(() => path);
      });

    expect(offenders).toEqual([]);
  });

  it("is actually scanning the components, not an empty list", () => {
    // The failure this guard is most likely to have itself: a path that
    // stops resolving, leaving every assertion above trivially true.
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES.some((f) => f.path.includes("MaterialLedgerCard"))).toBe(true);
  });

  it("would catch the exact classes that shipped broken", () => {
    // Pinning the regex against the real strings rather than trusting
    // it by eye — a guard that matches nothing passes forever.
    const sample = 'className="bg-white text-emerald-600 text-rose-600 text-amber-700"';
    expect(sample.match(PALETTE_CLASS)).toEqual([
      "text-emerald-600",
      "text-rose-600",
      "text-amber-700",
    ]);
    expect(/\bbg-white\b/.test(sample)).toBe(true);
  });

  it("strips comments without blinding itself", () => {
    // Both halves matter. Prose must not trip the guard, and stripping
    // it must not swallow the code on the next line — a stripper that
    // ate the file would make every assertion above pass forever.
    const src = [
      '// this shipped with bg-white and text-emerald-600, which was wrong',
      '/* and text-rose-600 in a block comment */',
      'const a = "https://example.com/x"; // trailing note',
      'const cls = "bg-white text-emerald-600";',
    ].join("\n");

    const stripped = stripComments(src);
    // The comment mentions survive nowhere; the real class does.
    expect(stripped.match(PALETTE_CLASS)).toEqual(["text-emerald-600"]);
    expect(stripped.match(/\bbg-white\b/g)).toEqual(["bg-white"]);
    // The URL's line kept its code rather than being cut at the "//".
    expect(stripped).toContain("https://example.com/x");
  });

  it("does not flag this app's own tokens", () => {
    // The other way a guard fails: too broad, everyone disables it.
    const ours =
      'className="bg-surface text-ink-900 text-status-success border-ink-200 bg-brand-600"';
    expect(ours.match(PALETTE_CLASS)).toBeNull();
  });
});
