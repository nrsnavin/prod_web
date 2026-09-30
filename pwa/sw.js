/* eslint-disable no-restricted-globals */
// ══════════════════════════════════════════════════════════════════
//  JARVIS SERVICE WORKER
//
//  Template: vite.config.ts fills in BUILD_ID and PRECACHE at build time
//  and writes the result to dist/sw.js. Never served in `npm run dev`.
//
//  What it caches — the APP, never the DATA:
//
//    /assets/*        hashed, immutable files → cache first. A file with
//                     a hash in its name can never change, so the network
//                     is only asked once.
//    PRECACHE         index.html, the entry chunks, manifest and icons →
//                     installed up front so the app opens with no network.
//    navigations      network first, cached index.html only when the
//                     network FAILS. index.html is what names this
//                     build's chunks; serving an old one while the
//                     network works is the "deploy did not appear" bug
//                     deploy/WEB_DEPLOY.md exists to prevent.
//
//  Never touched: anything not a GET, anything cross-origin (the API in
//  production), and /api/* (the API in dev). Stock levels, shift
//  figures and payroll are never served from a cache — a number from an
//  hour ago that looks current is worse than an error — and nothing a
//  user fetched stays on a shared shop-floor PC after they log out.
//
//  Updates: a new build installs alongside the running one and WAITS.
//  The app shows "new version ready"; only when the user presses Reload
//  does it take over (SKIP_WAITING). Taking over silently would swap the
//  code under a half-filled form.
// ══════════════════════════════════════════════════════════════════

const BUILD_ID = __BUILD_ID__;
const PRECACHE = __PRECACHE__;

const PREFIX = "jarvis-";
const SHELL = `${PREFIX}shell-${BUILD_ID}`;
// Shared across builds, so a tab still running the previous build can
// load a lazy chunk it had already seen. Pruned to the newest entries.
const ASSETS = `${PREFIX}assets`;
const MAX_ASSETS = 250;

const isHashedAsset = (url) => url.pathname.startsWith("/assets/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      const assets = await caches.open(ASSETS);
      // `cache: "reload"` so the install never picks up a copy the HTTP
      // cache is still holding from the previous deploy.
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, self.location.origin);
          const res = await fetch(new Request(url.href, { cache: "reload" }));
          if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
          await (isHashedAsset(url) ? assets : shell).put(path, res);
        })
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(PREFIX) && name !== SHELL && name !== ASSETS) {
          await caches.delete(name);
        }
      }
      const assets = await caches.open(ASSETS);
      const keys = await assets.keys(); // insertion order: oldest first
      for (const req of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) {
        await assets.delete(req);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/**
 * Which strategy a request gets, or null to leave it to the browser.
 * Exposed on `self` for the tests.
 */
function strategyFor(request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (url.pathname.startsWith("/api/")) return null;
  if (request.mode === "navigate") return "navigate";
  if (isHashedAsset(url)) return "asset";
  if (PRECACHE.includes(url.pathname)) return "shell";
  return null;
}
self.strategyFor = strategyFor;

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

async function navigate(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const shell = await caches.open(SHELL);
    const cached = (await shell.match("/index.html")) || (await shell.match("/"));
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const strategy = strategyFor(event.request);
  if (!strategy) return;
  if (strategy === "navigate") event.respondWith(navigate(event.request));
  else if (strategy === "asset") event.respondWith(cacheFirst(event.request, ASSETS));
  else event.respondWith(cacheFirst(event.request, SHELL));
});
