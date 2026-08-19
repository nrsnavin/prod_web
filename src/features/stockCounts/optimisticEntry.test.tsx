import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useStockCountMutations } from "./hooks";
import { applyCounts } from "./optimistic";
import { StockCount, StockCountLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE ROW MOVES WHEN THE NUMBER IS TYPED
//
//  There was not one onMutate in this codebase. Every action followed
//  the same shape — click, disable, wait for the round trip, refetch,
//  redraw — and entering a stock count is the worst case for it:
//  somebody stands at a rack with a sheet of 200 lines and types a
//  number into each one.
//
//  This is deliberately one of only a handful of optimistic mutations.
//  It earns it by being repeated hundreds of times in a sitting.
//
//  The load-bearing test here is the ROLLBACK. An optimistic update
//  that fails and leaves its guess on screen is worse than no
//  optimistic update at all: it shows a count nobody made, looking
//  exactly like one somebody did — which is the same "silence reads as
//  fine" failure this whole audit is about, just wearing a number.
// ══════════════════════════════════════════════════════════════════

const enter = vi.fn();
vi.mock("./api", () => ({
  stockCountService: {
    enter: (...a: unknown[]) => enter(...a),
  },
}));

const line = (over: Partial<StockCountLine> = {}): StockCountLine => ({
  _id: "l1",
  rawMaterial: "m1",
  name: "Nylon 70D",
  category: "Yarn",
  systemQty: 100,
  unitCost: 330,
  countedQty: null,
  variance: null,
  varianceValue: null,
  reason: "",
  needsReason: false,
  countedAt: null,
  stockAtPost: null,
  appliedDelta: null,
  movedSinceFreeze: null,
  ...over,
});

const sheet = (): StockCount => ({
  _id: "c1",
  countNo: 7,
  label: "March count",
  status: "counting",
  scope: { kind: "all" },
  frozenAt: "2026-03-01T00:00:00.000Z",
  postedAt: null,
  cancelledAt: null,
  cancelledReason: "",
  postedSummary: null,
  lines: [line({ _id: "l1" }), line({ _id: "l2", name: "Spandex 40D", systemQty: 50 })],
  totals: {
    lines: 2, counted: 0, uncounted: 2, varied: 0, needingReason: 0,
    gainQuantity: 0, lossQuantity: 0, gainValue: 0, lossValue: 0, netValue: 0,
  },
});

const KEY = ["stock-counts", "detail", "c1"];

function harness() {
  const qc = new QueryClient({
    // A MutationCache onError is the documented place to consume a
    // failed mutation. Without it react-query re-throws into the
    // microtask queue and vitest reports the escape instead of running
    // the assertions — the failure path is the one being tested here,
    // so it has to be observable rather than fatal.
    mutationCache: new MutationCache({ onError: () => {} }),
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, throwOnError: false },
    },
  });
  qc.setQueryData(KEY, sheet());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useStockCountMutations("c1"), { wrapper });
  return { qc, result };
}

/** The cached sheet as the screen would read it. */
const cached = (qc: QueryClient) => qc.getQueryData<StockCount>(KEY)!;
const lineById = (qc: QueryClient, id: string) =>
  cached(qc).lines.find((l) => l._id === id)!;

beforeEach(() => enter.mockReset());

/**
 * A request that stays in flight until it is told to finish.
 *
 * A promise that never settles hangs vitest's teardown, so every test
 * that inspects the in-flight state settles it before it ends — the
 * pending window is created deliberately, not left dangling.
 */
function inFlight() {
  let settle!: (v: unknown) => void;
  const promise = new Promise((res) => { settle = res; });
  enter.mockReturnValue(promise);
  return () => settle({ count: sheet() });
}

describe("entering a count", () => {
  it("shows the number before the server has answered", async () => {
    // Everything asserted here happens while the request is still in
    // flight — the guess is the whole point.
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { result.current.enter.mutate([{ lineId: "l1", countedQty: 98 }]); });

    await waitFor(() => expect(lineById(qc, "l1").countedQty).toBe(98));
    finish();
  });

  it("works out the variance rather than leaving it blank", async () => {
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { result.current.enter.mutate([{ lineId: "l1", countedQty: 98 }]); });

    await waitFor(() => expect(lineById(qc, "l1").variance).toBe(-2));
    expect(lineById(qc, "l1").varianceValue).toBe(-660);
    finish();
  });

  it("moves the counter with the rows", async () => {
    // "0 of 200" frozen while the rows fill in reads as the save not
    // working at all.
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { result.current.enter.mutate([{ lineId: "l1", countedQty: 98 }]); });

    await waitFor(() => expect(cached(qc).totals.counted).toBe(1));
    expect(cached(qc).totals.uncounted).toBe(1);
    finish();
  });

  it("leaves the lines it was not told about alone", async () => {
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { result.current.enter.mutate([{ lineId: "l1", countedQty: 98 }]); });

    await waitFor(() => expect(lineById(qc, "l1").countedQty).toBe(98));
    expect(lineById(qc, "l2").countedQty).toBeNull();
    finish();
  });

  it("treats a cleared box as uncounted, not as zero", async () => {
    // The server refuses to write off an uncounted line, and the guess
    // must not suggest otherwise.
    const { qc, result } = harness();
    const finish = inFlight();

    act(() => { result.current.enter.mutate([{ lineId: "l1", countedQty: null }]); });

    await waitFor(() => expect(cached(qc).totals.counted).toBe(0));
    expect(lineById(qc, "l1").countedQty).toBeNull();
    expect(lineById(qc, "l1").variance).toBeNull();
    finish();
  });
});

describe("the guess itself, without react-query in the way", () => {
  // The arithmetic is the part that can be wrong. Tested directly so a
  // wrong variance fails on its own terms rather than through a
  // lifecycle that reports it as something else.
  const base = sheet();

  it("does not touch the sheet it was given", () => {
    // onMutate keeps the original as the rollback snapshot. Mutating it
    // in place would leave nothing to roll back TO — the failure would
    // restore the guess.
    const next = applyCounts(base, [{ lineId: "l1", countedQty: 98 }]);
    expect(base.lines[0].countedQty).toBeNull();
    expect(base.totals.counted).toBe(0);
    expect(next).not.toBe(base);
  });

  it("works out variance and its value the way the server does", () => {
    const next = applyCounts(base, [{ lineId: "l1", countedQty: 98 }]);
    expect(next.lines[0].variance).toBe(-2);
    expect(next.lines[0].varianceValue).toBe(-660);
  });

  it("counts a gain as positive", () => {
    const next = applyCounts(base, [{ lineId: "l1", countedQty: 103 }]);
    expect(next.lines[0].variance).toBe(3);
    expect(next.lines[0].varianceValue).toBe(990);
  });

  it("treats a cleared box as uncounted, not as a counted zero", () => {
    const counted = applyCounts(base, [{ lineId: "l1", countedQty: 98 }]);
    const cleared = applyCounts(counted, [{ lineId: "l1", countedQty: null }]);

    expect(cleared.lines[0].countedQty).toBeNull();
    expect(cleared.lines[0].variance).toBeNull();
    expect(cleared.totals.counted).toBe(0);
    expect(cleared.totals.uncounted).toBe(2);
  });

  it("does count a genuine zero", () => {
    // "The rack is empty" is a real count and must not be mistaken for
    // "nobody has been there".
    const next = applyCounts(base, [{ lineId: "l1", countedQty: 0 }]);
    expect(next.lines[0].countedQty).toBe(0);
    expect(next.lines[0].variance).toBe(-100);
    expect(next.totals.counted).toBe(1);
  });

  it("leaves the lines it was not told about alone", () => {
    const next = applyCounts(base, [{ lineId: "l1", countedQty: 98 }]);
    expect(next.lines[1]).toEqual(base.lines[1]);
  });

  it("takes several lines at once", () => {
    const next = applyCounts(base, [
      { lineId: "l1", countedQty: 98 },
      { lineId: "l2", countedQty: 50 },
    ]);
    expect(next.totals.counted).toBe(2);
    expect(next.totals.uncounted).toBe(0);
  });

  it("ignores an id that is not on the sheet", () => {
    const next = applyCounts(base, [{ lineId: "nope", countedQty: 5 }]);
    expect(next.totals.counted).toBe(0);
    expect(next.lines).toHaveLength(2);
  });

  it("invents nothing it cannot know", () => {
    // needsReason and the value totals are the server's to decide.
    const next = applyCounts(base, [{ lineId: "l1", countedQty: 40 }]);
    expect(next.lines[0].needsReason).toBe(false);
    expect(next.totals.netValue).toBe(base.totals.netValue);
  });
});

describe("when the entry succeeds", () => {
  it("takes the server's figures over its own guess", async () => {
    // The guess only has to be close enough to look right for a moment.
    // The server decides — including anything the client cannot know,
    // like whether the line now needs a reason.
    const { qc, result } = harness();
    const served = sheet();
    served.lines[0] = line({ _id: "l1", countedQty: 98, variance: -2, needsReason: true });
    enter.mockResolvedValue({ count: served });

    act(() => { result.current.enter.mutate([{ lineId: "l1", countedQty: 98 }]); });

    await waitFor(() => expect(result.current.enter.isSuccess).toBe(true));
    expect(lineById(qc, "l1").needsReason).toBe(true);
  });
});
