// Central runtime configuration. Everything environment-specific is read
// here once so no other module touches import.meta.env directly (DIP —
// modules depend on this abstraction, not on Vite's env mechanism).

// ══════════════════════════════════════════════════════════════════
//  WHICH BACKEND IS THIS BUILD TALKING TO
//
//  Both defaults in this repo point at the same hardcoded production
//  host — this file for a built bundle, and VITE_PROXY_TARGET in
//  vite.config.ts for the dev server — and there is no .env in the
//  repo, only .env.example. So unless somebody wrote one, `npm run
//  dev` and `npm run build` BOTH talk to production, whatever backend
//  is running on the machine in front of you.
//
//  That is a reasonable default and a terrible silence. It produces
//  the one failure that cannot be diagnosed from any screen in the
//  app: a record is visible on the page and the API insists it does
//  not exist, because the page and the write are not looking at the
//  same database. Chasing that costs an afternoon, and the app never
//  says which backend it is on.
//
//  So the resolution is named — `apiBaseUrl` plus `apiSource` saying
//  WHY it is that — and logged once at boot. It is one line in the
//  console, and it is the first question worth asking when data goes
//  missing.
// ══════════════════════════════════════════════════════════════════

/** The host a build falls back to when nothing is configured. */
export const DEFAULT_PROD_API = "https://api.baluelastics.com/api/v2";

/** Where the API base URL came from. */
export type ApiSource = "env" | "prod-default" | "dev-proxy";

export function resolveApiBaseUrl(env: {
  VITE_API_BASE_URL?: string;
  PROD?: boolean;
}): { apiBaseUrl: string; apiSource: ApiSource } {
  if (env.VITE_API_BASE_URL) {
    return { apiBaseUrl: env.VITE_API_BASE_URL, apiSource: "env" };
  }
  // A production build with nothing set. Deliberate, but it is the case
  // where being wrong is invisible, so it gets named rather than
  // silently returned.
  if (env.PROD) return { apiBaseUrl: DEFAULT_PROD_API, apiSource: "prod-default" };
  // Dev: relative, so Vite proxies it and the httpOnly auth cookie is
  // same-origin. Where the proxy FORWARDS to is vite.config.ts's
  // business, and defaults to the same production host.
  return { apiBaseUrl: "/api/v2", apiSource: "dev-proxy" };
}

const resolved = resolveApiBaseUrl(
  import.meta.env as { VITE_API_BASE_URL?: string; PROD?: boolean }
);

export const config = {
  apiBaseUrl: resolved.apiBaseUrl,
  apiSource: resolved.apiSource,
  appName: "Jarvis ERP",
} as const;

/** One line, at boot, saying which backend this app is wired to. */
export function describeApiTarget(): string {
  const why = {
    env: "from VITE_API_BASE_URL",
    "prod-default": "built-in default — no VITE_API_BASE_URL was set at build time",
    "dev-proxy": "relative, forwarded by the Vite proxy (see VITE_PROXY_TARGET)",
  }[config.apiSource];
  return `${config.appName} → API ${config.apiBaseUrl} (${why})`;
}

if (typeof console !== "undefined" && import.meta.env?.MODE !== "test") {
  console.info(describeApiTarget());
}
