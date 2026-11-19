import { describe, it, expect, vi, beforeEach } from "vitest";

// An order sent twice — a second press on Save, a retry on a bad line —
// used to be two orders. The server now answers the second with the
// order the first made, and says so; this is that answer reaching the
// page instead of being flattened to "an order id".

const post = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { post: (...a: unknown[]) => post(...a), get: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } };
});

import { orderService } from "./api";

const body = {
  po: "ACME-17", customer: "c1", date: "2026-11-19", supplyDate: "2026-12-05", description: "",
  elasticOrdered: [{ elastic: "e1", quantity: 1000 }],
} as unknown as Parameters<typeof orderService.create>[0];

describe("saving a new order", () => {
  beforeEach(() => post.mockReset());

  it("gives the page the new order", async () => {
    post.mockResolvedValue({ success: true, orderId: "o1", fingerprint: {} });
    await expect(orderService.create(body)).resolves.toEqual({ orderId: "o1", duplicate: undefined, message: undefined });
    expect(post).toHaveBeenCalledWith("/order/create-order", body);
  });

  it("says when it was already saved, and which order that was", async () => {
    post.mockResolvedValue({
      success: true, duplicate: true, orderId: "o1", orderNo: 1042,
      message: "Already saved as order #1042 — the same order was sent twice.",
    });
    await expect(orderService.create(body)).resolves.toEqual({
      orderId: "o1", duplicate: true, message: "Already saved as order #1042 — the same order was sent twice.",
    });
  });
});
