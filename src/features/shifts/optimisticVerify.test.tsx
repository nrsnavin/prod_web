import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useShiftMutations } from "./hooks";
import { withoutShift } from "./pendingList";
import type { PendingShift } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE ROW GOES WHEN THE SHIFT IS VERIFIED
//
//  A supervisor works down the pending list one row at a time. Waiting
//  a round trip before each row disappears makes a queue of twenty feel
//  like work; the row going as it is verified makes it feel like
//  ticking things off.
//
//  The one that matters is the rollback. A verification that failed but
//  left the row gone is the worst possible outcome here: a shift nobody
//  checked, looking exactly like one somebody did — the same failure
//  the whole audit is about, this time wearing a tick.
// ══════════════════════════════════════════════════════════════════

const verifyProduction = vi.fn();
vi.mock("./api", () => ({
  shiftService: {
    verifyProduction: (...a: unknown[]) => verifyProduction(...a),
    createPlan: vi.fn(),
    deletePlan: vi.fn(),
  },
  productionService: {},
}));

const shift = (id: string): PendingShift =>
  ({ _id: id, submittedProductionMeters: 900 }) as PendingShift;

const KEY = ["shifts", "pending-verification"];
const PENDING = { count: 3, shifts: [shift("a"), shift("b"), shift("c")] };

function harness() {
  const qc = new QueryClient({
    mutationCache: new MutationCache({ onError: () => {} }),
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, throwOnError: false },
    },
  });
  qc.setQueryData(KEY, structuredClone(PENDING));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useShiftMutations(), { wrapper });
  return { qc, result };
}

const cached = (qc: QueryClient) =>
  qc.getQueryData<{ count: number; shifts: PendingShift[] }>(KEY)!;

const ids = (qc: QueryClient) => cached(qc).shifts.map((s) => s._id);

/** A request that stays in flight until told to finish. */
function inFlight() {
  let settle!: (v: unknown) => void;
  verifyProduction.mockReturnValue(new Promise((res) => { settle = res; }));
  return () => settle({ success: true });
}

const verifyB = (result: { current: ReturnType<typeof useShiftMutations> }) =>
  result.current.verify.mutate(
    { shiftId: "b", productionMeters: 900 },
    { onError: () => {} }
  );

beforeEach(() => verifyProduction.mockReset());

describe("verifying a shift", () => {
  it("takes the row off the list before the server answers", async () => {
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { verifyB(result); });

    await waitFor(() => expect(ids(qc)).toEqual(["a", "c"]));
    finish();
  });

  it("moves the count with the list", async () => {
    // "3 pending" beside two rows is the sort of disagreement that
    // makes somebody reload to find out which one is lying.
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { verifyB(result); });

    await waitFor(() => expect(cached(qc).count).toBe(2));
    finish();
  });

  it("removes only the shift that was verified", async () => {
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { verifyB(result); });

    await waitFor(() => expect(ids(qc)).toEqual(["a", "c"]));
    expect(ids(qc)).not.toContain("b");
    finish();
  });
});

describe("the transformation itself, without react-query in the way", () => {
  // The rollback depends on one property: the mutation keeps the
  // ORIGINAL as its snapshot, so this must not touch what it is given.
  // If it mutated in place there would be nothing to roll back to and a
  // failed verification would restore the guess — a shift nobody
  // checked, looking exactly like one somebody did.
  it("does not touch the list it was given", () => {
    const before = structuredClone(PENDING);
    const next = withoutShift(before, "b");

    expect(before.shifts.map((s) => s._id)).toEqual(["a", "b", "c"]);
    expect(before.count).toBe(3);
    expect(next).not.toBe(before);
  });

  it("takes off exactly the shift named", () => {
    const next = withoutShift(structuredClone(PENDING), "b");
    expect(next.shifts.map((s) => s._id)).toEqual(["a", "c"]);
  });

  it("moves the count with the list", () => {
    const next = withoutShift(structuredClone(PENDING), "b");
    expect(next.count).toBe(2);
  });

  it("leaves the list alone when the shift is not on it", () => {
    const next = withoutShift(structuredClone(PENDING), "zzz");
    expect(next.shifts).toHaveLength(3);
    expect(next.count).toBe(3);
  });

  it("survives an empty list", () => {
    const next = withoutShift({ count: 0, shifts: [] }, "a");
    expect(next.shifts).toEqual([]);
    expect(next.count).toBe(0);
  });
});
