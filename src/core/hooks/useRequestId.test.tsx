import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { newRequestId, useRequestId } from "./useRequestId";
import { useDcMutations } from "@/features/deliveryChallans/hooks";
import { usePoMutations } from "@/features/suppliers/hooks";

// A resend of the same submission carries the same id, so the server
// records it once; a changed or a new submission carries a new one.

const post = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { post: (...a: unknown[]) => post(...a), get: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

beforeEach(() => post.mockReset());

describe("useRequestId", () => {
  it("keeps the id while the same thing is resent, and renews it when it changes or succeeds", () => {
    const { result } = renderHook(() => useRequestId());
    const a = result.current.for({ qty: 10 });
    expect(result.current.for({ qty: 10 })).toBe(a);
    const b = result.current.for({ qty: 12 });
    expect(b).not.toBe(a);
    result.current.done();
    expect(result.current.for({ qty: 12 })).not.toBe(b);
  });

  it("makes ids that don't repeat", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRequestId()));
    expect(ids.size).toBe(200);
  });
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("a delivery challan sent again after a timeout", () => {
  it("carries the same request id, so stock leaves once", async () => {
    const { result } = renderHook(() => useDcMutations(), { wrapper });
    const body = { orderId: "o1", items: [{ elastic: "e1", quantity: 100 }] } as never;
    post.mockRejectedValueOnce(new Error("Request timed out")).mockResolvedValueOnce({ success: true, dc: { _id: "dc1" } });

    await act(async () => { await result.current.create.mutateAsync(body).catch(() => undefined); });
    await act(async () => { await result.current.create.mutateAsync(body); });

    const [first, second] = post.mock.calls.map((c) => (c[1] as { requestId: string }).requestId);
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);

    // The next challan is a new event.
    post.mockResolvedValueOnce({ success: true, dc: { _id: "dc2" } });
    await act(async () => { await result.current.create.mutateAsync(body); });
    expect((post.mock.calls[2][1] as { requestId: string }).requestId).not.toBe(first);
  });
});

describe("goods received", () => {
  it("sends a request id with the receipt", async () => {
    const { result } = renderHook(() => usePoMutations(), { wrapper });
    post.mockResolvedValue({ success: true, message: "ok", poStatus: "Partial" });
    await act(async () => {
      await result.current.inward.mutateAsync({ poId: "po1", items: [{ rawMaterial: "m1", quantity: 10 }] });
    });
    expect(post).toHaveBeenCalledWith("/supplier/inward-stock", {
      poId: "po1", items: [{ rawMaterial: "m1", quantity: 10 }], requestId: expect.any(String),
    });
  });
});
