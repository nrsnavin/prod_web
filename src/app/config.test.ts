import { describe, it, expect } from "vitest";
import { resolveApiBaseUrl, DEFAULT_PROD_API, describeApiTarget, config } from "./config";

// ══════════════════════════════════════════════════════════════════
//  THE DEFAULT THAT COSTS AN AFTERNOON
//
//  Both defaults in this repo point at the same hardcoded production
//  host: this file for a built bundle, VITE_PROXY_TARGET for the dev
//  server. There is no .env in the repo, only .env.example. So unless
//  somebody wrote one, `npm run dev` and `npm run build` both talk to
//  production — whatever backend is running on the machine in front
//  of you.
//
//  The failure that produces is the one that cannot be diagnosed from
//  any screen: a record is on the page and the API says it does not
//  exist, because the page and the write are reading different
//  databases. It was reported twice, in two different shapes ("no
//  machine has id ...", then "no service log has id ..."), and an
//  end-to-end run through a real browser proved the code path itself
//  was correct at every step.
//
//  These tests do not change the default — a deploy depends on it.
//  They make it a stated fact with a name, so the next person can see
//  which backend they are on instead of inferring it.
// ══════════════════════════════════════════════════════════════════

describe("which backend a build talks to", () => {
  it("uses an explicit override above everything else", () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: "http://localhost:8000/api/v2", PROD: true }))
      .toEqual({ apiBaseUrl: "http://localhost:8000/api/v2", apiSource: "env" });
  });

  it("honours the override in dev too", () => {
    // Pointing a dev server at a local backend must not be silently
    // overruled by the relative-path branch.
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: "http://localhost:8000/api/v2", PROD: false }))
      .toEqual({ apiBaseUrl: "http://localhost:8000/api/v2", apiSource: "env" });
  });

  it("falls back to the production host on a build with nothing set", () => {
    // This is the case that is invisible when it is wrong.
    expect(resolveApiBaseUrl({ PROD: true }))
      .toEqual({ apiBaseUrl: DEFAULT_PROD_API, apiSource: "prod-default" });
  });

  it("goes relative in dev so the auth cookie stays same-origin", () => {
    expect(resolveApiBaseUrl({ PROD: false }))
      .toEqual({ apiBaseUrl: "/api/v2", apiSource: "dev-proxy" });
  });

  it("treats an empty string as unset rather than as a base URL", () => {
    // `VITE_API_BASE_URL=` in a .env is somebody clearing it, not
    // asking every request to go to the current origin's root.
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: "", PROD: true }).apiSource)
      .toBe("prod-default");
  });
});

describe("saying which backend, out loud", () => {
  it("names the URL and why it is that one", () => {
    const line = describeApiTarget();
    expect(line).toContain(config.apiBaseUrl);
    // The reason matters as much as the URL: "I set that" and "nobody
    // set anything" are different problems.
    expect(line).toMatch(/VITE_API_BASE_URL|Vite proxy|built-in default/);
  });
});
