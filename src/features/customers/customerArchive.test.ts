import { describe, it, expect, vi, beforeEach } from "vitest";

// The detail page's Deactivate button called DELETE /customer/delete-customer
// — a route that never existed, so it 404'd. The path and verb are the
// contract, and a mismatch is invisible until someone clicks.

const patch = vi.fn().mockResolvedValue({});
const del = vi.fn().mockResolvedValue({});

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return {
    ...actual,
    httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch, delete: del },
  };
});

const { customerService } = await import("./api");

beforeEach(() => {
  patch.mockClear();
  del.mockClear();
});

describe("archiving a customer", () => {
  it("PATCHes the archive route the server actually serves", async () => {
    await customerService.setArchived("c1", true);
    expect(patch).toHaveBeenCalledWith("/customer/c1/archive", { archived: true });
    // Nothing is deleted, so nothing issues a DELETE.
    expect(del).not.toHaveBeenCalled();
  });

  it("restores through the same route", async () => {
    await customerService.setArchived("c1", false);
    expect(patch).toHaveBeenCalledWith("/customer/c1/archive", { archived: false });
  });
});
