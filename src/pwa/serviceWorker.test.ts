// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import template from "../../pwa/sw.js?raw";
import { entryFiles, renderServiceWorker } from "../../pwa/vitePlugin";

// ══════════════════════════════════════════════════════════════════
//  The real pwa/sw.js, filled in exactly as the build fills it, run
//  against a fake worker scope. What matters most here is what it does
//  NOT do: API calls and anything cross-origin are never answered from
//  a cache.
// ══════════════════════════════════════════════════════════════════

const ORIGIN = "https://erp.example.com";
const PRECACHE = ["/index.html", "/site.webmanifest", "/assets/index-abc.js"];

class FakeCache {
  store = new Map<string, Response>();
  key = (r: RequestInfo | URL) => new URL(typeof r === "string" ? r : r instanceof URL ? r.href : r.url, ORIGIN).href;
  async match(r: RequestInfo) { return this.store.get(this.key(r))?.clone(); }
  async put(r: RequestInfo, res: Response) { this.store.set(this.key(r), res); }
  async delete(r: RequestInfo) { return this.store.delete(this.key(r)); }
  async keys() { return [...this.store.keys()].map((url) => new Request(url)); }
}

class FakeCaches {
  named = new Map<string, FakeCache>();
  async open(n: string) {
    if (!this.named.has(n)) this.named.set(n, new FakeCache());
    return this.named.get(n)!;
  }
  async keys() { return [...this.named.keys()]; }
  async delete(n: string) { return this.named.delete(n); }
}

type Handler = (e: Record<string, unknown>) => void;

function boot(opts: { buildId?: string } = {}) {
  const handlers: Record<string, Handler> = {};
  const caches = new FakeCaches();
  const fetch = vi.fn(async (r: RequestInfo) => new Response(`net:${typeof r === "string" ? r : r.url}`));
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (t: string, h: Handler) => (handlers[t] = h),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
  } as Record<string, unknown>;
  const code = renderServiceWorker(template, { buildId: opts.buildId ?? "b1", precache: PRECACHE });
  new Function("self", "caches", "fetch", code)(self, caches, fetch);

  const until = async (type: string, extra: Record<string, unknown> = {}) => {
    let p: Promise<unknown> = Promise.resolve();
    handlers[type]({ ...extra, waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  };
  // A plain object: Node's Request cannot be given mode "navigate", and
  // the worker only reads url, method and mode.
  const request = async (url: string, init: { method?: string; mode?: string } = {}) => {
    const req = { url: new URL(url, ORIGIN).href, method: init.method ?? "GET", mode: init.mode ?? "cors" };
    let responded: Promise<Response> | null = null;
    handlers.fetch({ request: req, respondWith: (r: Promise<Response>) => (responded = r) });
    return responded ? await (responded as Promise<Response>) : null;
  };
  return { self, handlers, caches, fetch, until, request, strategyFor: self.strategyFor as (r: unknown) => string | null };
}

describe("service worker", () => {
  let sw: ReturnType<typeof boot>;
  beforeEach(() => { sw = boot(); });

  it("fills in the build id and precache list", () => {
    const code = renderServiceWorker(template, { buildId: "abc", precache: ["/x"] });
    expect(code).toContain('const BUILD_ID = "abc";');
    expect(code).toContain('const PRECACHE = ["/x"];');
    expect(code).not.toMatch(/__BUILD_ID__|__PRECACHE__/);
  });

  describe("never touches data", () => {
    it("leaves API calls, cross-origin requests and writes to the browser", async () => {
      expect(await sw.request("/api/v2/materials/ledger?id=1")).toBeNull();
      expect(await sw.request("/api/v2/user/login-user", { mode: "navigate" })).toBeNull();
      expect(await sw.request("https://api.example.com/api/v2/dashboard/kpis")).toBeNull();
      // Another origin whose path merely LOOKS like ours.
      expect(await sw.request("https://cdn.example.net/assets/index-abc.js")).toBeNull();
      expect(await sw.request("https://api.example.com/v2/materials/ledger.pdf", { mode: "navigate" })).toBeNull();
      expect(await sw.request("/assets/index-abc.js", { method: "POST" })).toBeNull();
      expect(sw.fetch).not.toHaveBeenCalled();
    });

    it("ignores unlisted same-origin files", async () => {
      expect(await sw.request("/robots.txt")).toBeNull();
    });
  });

  describe("install", () => {
    it("puts the shell and the entry chunks on the device", async () => {
      await sw.until("install");
      const shell = await sw.caches.open("jarvis-shell-b1");
      const assets = await sw.caches.open("jarvis-assets");
      expect(await shell.match("/index.html")).toBeTruthy();
      expect(await shell.match("/site.webmanifest")).toBeTruthy();
      expect(await assets.match("/assets/index-abc.js")).toBeTruthy();
      // Bypasses the HTTP cache, so it never installs last deploy's copy.
      expect((sw.fetch.mock.calls[0][0] as Request).cache).toBe("reload");
    });

    it("fails the install if any file is missing, rather than installing half an app", async () => {
      sw.fetch.mockImplementation(async (r: RequestInfo) =>
        new Response("", { status: String((r as Request).url).includes("index-abc") ? 404 : 200 })
      );
      await expect(sw.until("install")).rejects.toThrow(/precache/);
    });
  });

  describe("navigation", () => {
    it("always asks the network first, so a deploy shows up immediately", async () => {
      await sw.until("install");
      sw.fetch.mockClear();
      const res = await sw.request("/jobs/42", { mode: "navigate" });
      expect(await res!.text()).toBe(`net:${ORIGIN}/jobs/42`);
    });

    it("opens the installed app shell when there is no network", async () => {
      await sw.until("install");
      sw.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
      const res = await sw.request("/jobs/42", { mode: "navigate" });
      expect(await res!.text()).toBe(`net:${ORIGIN}/index.html`);
    });

    it("surfaces the network error if nothing is installed yet", async () => {
      sw.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(sw.request("/jobs/42", { mode: "navigate" })).rejects.toThrow("Failed to fetch");
    });
  });

  describe("hashed assets", () => {
    it("are fetched once and then served from the device", async () => {
      const first = await sw.request("/assets/JobListPage-x1.js");
      expect(await first!.text()).toBe(`net:${ORIGIN}/assets/JobListPage-x1.js`);
      sw.fetch.mockRejectedValue(new TypeError("offline"));
      const again = await sw.request("/assets/JobListPage-x1.js");
      expect(await again!.text()).toBe(`net:${ORIGIN}/assets/JobListPage-x1.js`);
      expect(sw.fetch).toHaveBeenCalledTimes(1); // the second came from the device
    });

    it("does not store an error response", async () => {
      sw.fetch.mockResolvedValue(new Response("", { status: 404 }));
      await sw.request("/assets/gone-1.js");
      expect(await (await sw.caches.open("jarvis-assets")).match("/assets/gone-1.js")).toBeUndefined();
    });
  });

  describe("activate", () => {
    it("drops the previous build's shell, keeps shared assets and other apps' caches", async () => {
      await sw.caches.open("jarvis-shell-old");
      await sw.caches.open("someone-else");
      await sw.until("install");
      await sw.until("activate");
      expect(await sw.caches.keys()).toEqual(
        expect.arrayContaining(["jarvis-shell-b1", "jarvis-assets", "someone-else"])
      );
      expect(await sw.caches.keys()).not.toContain("jarvis-shell-old");
      expect((sw.self.clients as { claim: () => void }).claim).toHaveBeenCalled();
    });

    it("keeps the asset cache from growing without end", async () => {
      const assets = await sw.caches.open("jarvis-assets");
      for (let i = 0; i < 260; i++) await assets.put(`/assets/c${i}.js`, new Response(""));
      await sw.until("activate");
      const left = (await assets.keys()).map((r) => new URL(r.url).pathname);
      expect(left).toHaveLength(250);
      expect(left).not.toContain("/assets/c0.js"); // oldest go first
      expect(left).toContain("/assets/c259.js");
    });
  });

  it("takes over only when the user asks for the update", async () => {
    const skip = sw.self.skipWaiting as ReturnType<typeof vi.fn>;
    await sw.until("install");
    await sw.until("activate");
    sw.handlers.message({ data: { type: "SOMETHING_ELSE" } });
    expect(skip).not.toHaveBeenCalled();
    sw.handlers.message({ data: { type: "SKIP_WAITING" } });
    expect(skip).toHaveBeenCalledTimes(1);
  });
});

describe("entryFiles", () => {
  it("lists the entry, what it imports statically, and their CSS — not lazy routes", () => {
    const chunk = (isEntry: boolean, imports: string[], css: string[] = []) => ({
      type: "chunk", isEntry, imports, viteMetadata: { importedCss: new Set(css) },
    });
    const bundle = {
      "assets/index-1.js": chunk(true, ["assets/vendor-react-2.js"], ["assets/index-3.css"]),
      "assets/vendor-react-2.js": chunk(false, []),
      "assets/JobListPage-4.js": chunk(false, ["assets/vendor-react-2.js"]),
      "assets/index-3.css": { type: "asset" },
    };
    expect(entryFiles(bundle as never)).toEqual([
      "/assets/index-1.js", "/assets/index-3.css", "/assets/vendor-react-2.js",
    ]);
  });
});
