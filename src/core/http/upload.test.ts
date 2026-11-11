import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ApiError } from "./httpClient";
import { apiUrl, DEFAULT_PROD_API } from "@/app/config";

// ══════════════════════════════════════════════════════════════════
//  WHERE A FILE, AND A DOWNLOAD LINK, ARE SENT
//
//  Nineteen uploads were a bare `fetch("/api/v2/…")` and sixteen download
//  links were written out the same way. Both are relative to the PAGE.
//  The dev server forwards /api, so every one of them worked on a
//  developer's machine and in every test; a built app is served from one
//  host and talks to the API on another, where they all pointed at the
//  web host. Held here: files go through the shared client, links are
//  built from the configured address, and nothing in the app writes an
//  API path out by hand again.
// ══════════════════════════════════════════════════════════════════

const upload = vi.fn();
vi.mock("./httpClient", async (original) => {
  const real = await original<typeof import("./httpClient")>();
  return { ...real, httpClient: { upload: (...a: unknown[]) => upload(...(a as [])) } };
});
afterEach(() => upload.mockReset());

const form = () => { const fd = new FormData(); fd.append("file", new Blob(["x"]), "x.pdf"); return fd; };

describe("uploadForm", () => {
  it("sends the form through the shared client, to the path given", async () => {
    const { uploadForm } = await import("./upload");
    upload.mockResolvedValue({ ok: 1 });
    const fd = form();
    await expect(uploadForm("/accounts/scan", fd, "Could not read the bill")).resolves.toEqual({ ok: 1 });
    expect(upload).toHaveBeenCalledWith("/accounts/scan", fd);
  });

  it("keeps the server's own words, and its code", async () => {
    const { uploadForm } = await import("./upload");
    upload.mockRejectedValue(new ApiError("That file is over 10 MB", 400, undefined, "TOO_BIG", { message: "That file is over 10 MB" }));
    await expect(uploadForm("/accounts/scan", form(), "Could not read the bill")).rejects.toMatchObject({ message: "That file is over 10 MB", status: 400, code: "TOO_BIG" });
  });

  it("says what was being done when the server gave no reason", async () => {
    const { uploadForm } = await import("./upload");
    upload.mockRejectedValue(new ApiError("Request failed with status code 502", 502, undefined, undefined, undefined));
    await expect(uploadForm("/accounts/scan", form(), "Could not read the bill")).rejects.toMatchObject({ message: "Could not read the bill", status: 502 });
  });

  it("keeps a timeout's or a dropped connection's own message", async () => {
    const { uploadForm } = await import("./upload");
    upload.mockRejectedValue(new ApiError("Request timed out — check your connection."));
    await expect(uploadForm("/accounts/scan", form(), "Could not read the bill")).rejects.toMatchObject({ message: "Request timed out — check your connection." });
  });

  it("is always an Error with a message, whatever was thrown", async () => {
    const { uploadForm } = await import("./upload");
    upload.mockRejectedValue("nope");
    await expect(uploadForm("/x", form())).rejects.toMatchObject({ message: "Upload failed" });
  });
});

describe("apiUrl", () => {
  it("is the configured API address with the path on the end", () => {
    expect(apiUrl("/accounts/notes/9/pdf", DEFAULT_PROD_API)).toBe("https://api.baluelastics.com/api/v2/accounts/notes/9/pdf");
    expect(apiUrl("accounts/notes/9/pdf", "https://api.example.com/api/v2/")).toBe("https://api.example.com/api/v2/accounts/notes/9/pdf");
    // In dev it stays relative, and the dev server forwards it.
    expect(apiUrl("/accounts/export/bills?from=2026-04-01", "/api/v2")).toBe("/api/v2/accounts/export/bills?from=2026-04-01");
  });
});

describe("nothing writes an API path out by hand", () => {
  const SRC = join(__dirname, "../..");
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) files.push(full);
    }
  })(SRC);

  // The places allowed to know an address or the transport: the staff
  // app's config and client, the floor's own client, and the customer
  // portal's own client (a separate app on its own host, which builds an
  // absolute address and keeps a relative one for its dev server only).
  // Everything else in the portal is held to the rule like the rest.
  const EXEMPT = new Set(["app/config.ts", "core/http/httpClient.ts", "features/floor/floorClient.ts", "portal/api.ts"]);
  const code = (file: string) => readFileSync(file, "utf8").split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));

  it("no string literal starts with /api/v2", () => {
    const found: string[] = [];
    for (const f of files) {
      const rel = relative(SRC, f);
      if (EXEMPT.has(rel)) continue;
      for (const { line, n } of code(f)) if (/["'`]\/api\/v\d/.test(line)) found.push(`${rel}:${n}`);
    }
    expect(found).toEqual([]);
  });

  it("no feature calls fetch itself", () => {
    const found: string[] = [];
    for (const f of files) {
      const rel = relative(SRC, f);
      if (!rel.startsWith("features/") || EXEMPT.has(rel)) continue;
      for (const { line, n } of code(f)) if (/(^|[^.\w])fetch\(/.test(line)) found.push(`${rel}:${n}`);
    }
    expect(found).toEqual([]);
  });

  it("a form with files goes through upload(), which waits for it to be read", () => {
    // Eight uploads were posted as ordinary calls. The base address was
    // right, the wait was not: a photo the model takes 40 seconds over
    // was given up on at 20, as "check your connection".
    const found: string[] = [];
    for (const f of files) {
      const rel = relative(SRC, f);
      if (EXEMPT.has(rel)) continue;
      const src = readFileSync(f, "utf8");
      if (!/new FormData\(/.test(src)) continue;
      const forms = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*new FormData\(/g)].map((m) => m[1]);
      for (const { line, n } of code(f)) {
        const m = /httpClient\.(?:post|put|patch)(?:<[^(]*>)?\(([^)]*)\)/.exec(line);
        if (m && forms.some((name) => new RegExp(`,\\s*${name}\\s*$`).test(m[1].trim()))) found.push(`${rel}:${n}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("the scan is really reading the app", () => {
    expect(files.length).toBeGreaterThan(300);
  });
});
