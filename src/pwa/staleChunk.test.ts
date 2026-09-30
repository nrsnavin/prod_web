import { describe, expect, it, vi } from "vitest";
import { RELOAD_WINDOW_MS, isChunkLoadError, recoverFromStaleChunk } from "./staleChunk";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("stale chunk recovery", () => {
  it("recognises every browser's wording of a failed chunk import", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/A-1.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("reloads once for a stale chunk, and renders nothing meanwhile", async () => {
    const deps = { storage: memory(), now: () => 1_000_000, reload: vi.fn() };
    const p = recoverFromStaleChunk(new TypeError("Importing a module script failed."), deps);
    expect(deps.reload).toHaveBeenCalledTimes(1);
    const settled = await Promise.race([p.then(() => "settled", () => "settled"), Promise.resolve("pending")]);
    expect(settled).toBe("pending");
  });

  it("does not reload in a loop when the reload did not help", () => {
    const deps = { storage: memory(), now: () => 1_000_000, reload: vi.fn() };
    const err = new TypeError("Importing a module script failed.");
    recoverFromStaleChunk(err, deps);
    deps.now = () => 1_000_000 + RELOAD_WINDOW_MS - 1;
    expect(() => recoverFromStaleChunk(err, deps)).toThrow(err);
    expect(deps.reload).toHaveBeenCalledTimes(1);
    // Much later it is a new deploy, and reloading is right again.
    deps.now = () => 1_000_000 + RELOAD_WINDOW_MS + 1;
    recoverFromStaleChunk(err, deps);
    expect(deps.reload).toHaveBeenCalledTimes(2);
  });

  it("rethrows ordinary errors, and never reloads without storage to remember it by", () => {
    const deps = { storage: memory(), now: () => 1, reload: vi.fn() };
    const bug = new Error("render bug");
    expect(() => recoverFromStaleChunk(bug, deps)).toThrow(bug);
    const noStore = { storage: null, now: () => 1, reload: vi.fn() };
    expect(() => recoverFromStaleChunk(new TypeError("Importing a module script failed."), noStore)).toThrow();
    expect(deps.reload).not.toHaveBeenCalled();
    expect(noStore.reload).not.toHaveBeenCalled();
  });
});
