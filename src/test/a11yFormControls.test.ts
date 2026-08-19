import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";

// ══════════════════════════════════════════════════════════════════
//  EVERY FORM CONTROL HAS TO HAVE A NAME
//
//  The Input and Select components wire labels up correctly. The gap
//  was everywhere they were bypassed for a raw element: bare <input>
//  and <textarea> tags with neither a bound label nor an aria-label.
//
//  A control with no accessible name is not only unusable with a
//  screen reader — it is unaddressable in tests, which is exactly why
//  several of those fields had none. The two problems are the same
//  problem.
//
//  ── Why a test and not a lint rule ───────────────────────────────
//  The audit suggested jsx-a11y, and it would be the conventional
//  answer. This repository has no ESLint at all, so that would mean
//  adding a whole toolchain to enforce one rule. A test does the same
//  job here: it runs in the suite that already runs, it fails the same
//  way, and it can encode the one thing a generic rule would get
//  wrong (see below).
//
//  ── The subtlety a naive scan gets wrong ─────────────────────────
//  You cannot find a tag's attributes with /<input[^>]*>/. JSX is full
//  of arrow functions, and `onChange={(e) => ...}` contains a `>` — so
//  that pattern stops scanning halfway through the tag and reports a
//  control as unlabelled when its aria-label is simply written after
//  an arrow. This scan brace-matches instead, which is why it does not
//  produce the four false positives the first version did.
// ══════════════════════════════════════════════════════════════════

// process.cwd(), not import.meta.url: vitest rewrites module URLs to be
// root-relative, so `new URL("../", import.meta.url)` resolves to "/src"
// — a directory that does not exist. globSync then returned zero files
// and the test passed while scanning nothing at all.
//
// Which is the very failure this audit is about, arriving in the tool
// meant to prevent it. Hence the count assertion below: a scan that
// finds nothing must fail loudly rather than report success.
const SRC = join(process.cwd(), "src");

/** Source files worth scanning — tests and generated code excluded. */
function sourceFiles(): string[] {
  const files = globSync("**/*.tsx", { cwd: SRC })
    .filter((f) => !f.includes(".test.") && !f.includes("__mocks__"))
    .map((f) => join(SRC, f));

  // A silent zero would make this test pass by scanning nothing.
  if (files.length < 100) {
    throw new Error(
      `Only ${files.length} source files found under ${SRC} — the scan is ` +
      `misconfigured, and a passing result would mean nothing.`
    );
  }
  return files;
}

/**
 * The full text of a JSX opening tag starting at `start`, found by
 * tracking brace depth so a `>` inside `{...}` does not end it.
 */
function openingTag(src: string, start: number): string {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

/** Is this control nested inside a <label>, which names it implicitly? */
function insideLabel(src: string, pos: number): boolean {
  const before = src.slice(0, pos);
  const opens = (before.match(/<label\b/g) ?? []).length;
  const closes = (before.match(/<\/label>/g) ?? []).length;
  return opens > closes;
}

function unnamedControls(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const found: string[] = [];

  for (const m of src.matchAll(/<(input|textarea|select)\b/g)) {
    const start = m.index!;
    const tag = openingTag(src, start);

    // A hidden input is not in the accessibility tree at all.
    if (/type=["']hidden["']/.test(tag)) continue;
    // Named directly, or by a <label htmlFor> pointing at its id.
    if (/\baria-label(ledby)?[=\s]/.test(tag)) continue;
    if (/\bid=/.test(tag)) continue;
    if (insideLabel(src, start)) continue;

    // Comment prose that happens to mention a tag.
    const lineStart = src.lastIndexOf("\n", start) + 1;
    const linePrefix = src.slice(lineStart, start).trim();
    if (linePrefix.startsWith("//") || linePrefix.startsWith("*")) continue;

    const line = src.slice(0, start).split("\n").length;
    found.push(`${file.replace(SRC, "")}:${line} <${m[1]}>`);
  }
  return found;
}

describe("every form control can be named", () => {
  it("has no bare input, textarea or select without an accessible name", () => {
    const offenders = sourceFiles().flatMap(unnamedControls);

    // Listed in the failure so a new one names itself rather than
    // leaving somebody to find it.
    expect(offenders).toEqual([]);
  });
});

describe("the scan itself", () => {
  it("does not stop at the > inside an arrow function", () => {
    // The bug that produced four false positives the first time this
    // sweep was run.
    const src = `<input onChange={(e) => set(e)} aria-label="Search" />`;
    expect(openingTag(src, 0)).toContain('aria-label="Search"');
  });

  it("ends the tag at the real closing bracket", () => {
    const src = `<input value={v} /><div>after</div>`;
    expect(openingTag(src, 0)).toBe("<input value={v} />");
  });

  it("counts a control inside a label as named", () => {
    const src = `<label><input type="checkbox" /> Pin it</label>`;
    expect(insideLabel(src, src.indexOf("<input"))).toBe(true);
  });

  it("counts a control after a closed label as unnamed", () => {
    const src = `<label>x</label><input type="checkbox" />`;
    expect(insideLabel(src, src.indexOf("<input"))).toBe(false);
  });

  it("refuses to pass by scanning nothing", () => {
    // The first version of this file resolved its source directory
    // wrongly, found zero files, and reported success. Silence read as
    // fine — inside the guard written to stop exactly that.
    expect(sourceFiles().length).toBeGreaterThan(100);
  });
});
