import { describe, it, expect, vi, beforeEach } from "vitest";

// Express answers a KNOWN path with an UNKNOWN verb by 404ing, so a
// method mismatch reads to the user as "not found" for a record that
// plainly exists — which is exactly how pressing Start reported a
// missing warping. The verb is part of the contract, so it is pinned.

const post = vi.fn().mockResolvedValue({});
const put = vi.fn().mockResolvedValue({});
const patch = vi.fn().mockResolvedValue({});
const get = vi.fn().mockResolvedValue({});

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return { ...actual, httpClient: { get, post, put, patch, delete: vi.fn() } };
});

const { warpingService } = await import("./api");

beforeEach(() => {
  post.mockClear();
  put.mockClear();
  patch.mockClear();
});

describe("the warping lifecycle calls match the routes that serve them", () => {
  it("starts with POST /warping/start", async () => {
    await warpingService.start("w1");
    expect(post).toHaveBeenCalledWith("/warping/start", { id: "w1" });
    expect(put).not.toHaveBeenCalled();
  });

  it("completes with POST /warping/complete", async () => {
    await warpingService.complete("w1");
    expect(post).toHaveBeenCalledWith("/warping/complete", { id: "w1" });
    expect(put).not.toHaveBeenCalled();
  });

  it("cancels with PATCH /warping/cancel/:id", async () => {
    await warpingService.cancel("w1");
    expect(patch).toHaveBeenCalledWith("/warping/cancel/w1");
  });
});
