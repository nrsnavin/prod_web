import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StockCountDetailPage } from "./StockCountDetailPage";
import { StockCount, StockCountLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE COUNT SHEET
//
//  What matters on this screen, in order of how expensive getting it
//  wrong would be:
//
//    • an uncounted line shows as uncounted, not as zero — the server
//      refuses to write those off and the screen must not suggest
//      otherwise
//    • clearing a box has to be possible, because "nobody has been to
//      that rack" is a real state somebody needs to get back to
//    • a line needing a reason is visible before Post is pressed, not
//      after the server refuses it
//    • the difference and its value read the right way round
// ══════════════════════════════════════════════════════════════════

const enterMutate = vi.fn(async () => ({ count: null }));
const postMutate = vi.fn(async () => count);
const cancelMutate = vi.fn(async () => count);
const toast = vi.fn();

let count: StockCount;

vi.mock("./hooks", () => ({
  useStockCount: () => ({ data: count, isLoading: false, isError: false }),
  useStockCountMutations: () => ({
    enter: { mutateAsync: enterMutate, isPending: false },
    post: { mutateAsync: postMutate, isPending: false },
    cancel: { mutateAsync: cancelMutate, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

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

const sheet = (lines: StockCountLine[], over: Partial<StockCount> = {}): StockCount => {
  const counted = lines.filter((l) => l.countedQty !== null);
  const varied = counted.filter((l) => l.variance !== 0);
  return {
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
    lines,
    totals: {
      lines: lines.length,
      counted: counted.length,
      uncounted: lines.length - counted.length,
      varied: varied.length,
      needingReason: counted.filter((l) => l.needsReason).length,
      gainQuantity: 0,
      lossQuantity: 0,
      gainValue: 0,
      lossValue: 0,
      netValue: counted.reduce((s, l) => s + (l.varianceValue ?? 0), 0),
    },
    ...over,
  };
};

const renderSheet = () =>
  render(
    <MemoryRouter initialEntries={["/stock-counts/c1"]}>
      <Routes>
        <Route path="/stock-counts/:id" element={<StockCountDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("StockCountDetailPage", () => {
  beforeEach(() => {
    enterMutate.mockClear();
    postMutate.mockClear();
    cancelMutate.mockClear();
    toast.mockClear();
  });

  it("shows an uncounted line as uncounted, never as zero", async () => {
    count = sheet([line()]);
    renderSheet();

    const box = screen.getByRole("spinbutton");
    expect(box).toHaveValue(null);
    // And the difference column says nothing rather than −100.
    expect(screen.queryByText("−100")).not.toBeInTheDocument();
    expect(screen.getByText("0 / 1")).toBeInTheDocument();
  });

  it("sends a counted quantity when the box loses focus", async () => {
    count = sheet([line()]);
    renderSheet();

    const box = screen.getByRole("spinbutton");
    await userEvent.type(box, "94");
    await userEvent.tab();

    expect(enterMutate).toHaveBeenCalledWith([{ lineId: "l1", countedQty: 94 }]);
  });

  it("clears a line back to uncounted when the box is emptied", async () => {
    // A mis-keyed row has to be undoable without abandoning the count —
    // and null, not 0, is what puts it back to "nobody has been yet".
    count = sheet([line({ countedQty: 40, variance: -60, varianceValue: -19800 })]);
    renderSheet();

    await userEvent.clear(screen.getByRole("spinbutton"));
    await userEvent.tab();

    expect(enterMutate).toHaveBeenCalledWith([{ lineId: "l1", countedQty: null }]);
  });

  it("sends nothing when the figure has not changed", async () => {
    count = sheet([line({ countedQty: 94, variance: -6, varianceValue: -1980 })]);
    renderSheet();

    await userEvent.click(screen.getByRole("spinbutton"));
    await userEvent.tab();

    expect(enterMutate).not.toHaveBeenCalled();
  });

  it("reads the difference and its value the right way round", async () => {
    count = sheet([line({ countedQty: 94, variance: -6, varianceValue: -1980 })]);
    renderSheet();

    const row = screen.getByText("Nylon 70D").closest("tr")!;
    expect(within(row).getByText("−6")).toBeInTheDocument();
    expect(within(row).getByText("−₹1,980")).toBeInTheDocument();
  });

  it("says which lines need a reason before Post is pressed", async () => {
    count = sheet([line({ countedQty: 10, variance: -90, varianceValue: -29700, needsReason: true })]);
    renderSheet();

    expect(screen.getByText(/need a reason before this count can be posted/i)).toBeInTheDocument();
  });

  it("will not offer Post before anything has been counted", async () => {
    count = sheet([line()]);
    renderSheet();
    expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
  });

  it("posts, and says what it corrected", async () => {
    count = sheet([line({ countedQty: 94, variance: -6, varianceValue: -1980 })]);
    postMutate.mockResolvedValueOnce({
      ...count,
      countNo: 7,
      status: "posted",
      postedSummary: {
        linesCounted: 1, linesVaried: 1, gainQuantity: 0, lossQuantity: -6,
        gainValue: 0, lossValue: -1980, netValue: -1980, linesMovedSinceFreeze: 0,
      },
    } as StockCount);
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(postMutate).toHaveBeenCalledWith(false);
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/1 line\(s\) corrected, net −₹1,980/),
      "success"
    );
  });

  it("locks the sheet once it is posted", async () => {
    count = sheet(
      [line({ countedQty: 94, variance: -6, varianceValue: -1980, appliedDelta: -6, stockAtPost: 100 })],
      { status: "posted", postedAt: "2026-03-02T00:00:00.000Z" }
    );
    renderSheet();

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^post$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel count/i })).not.toBeInTheDocument();
  });

  it("explains a line that moved while the count was open", async () => {
    count = sheet(
      [line({ countedQty: 94, variance: -6, varianceValue: -1980, movedSinceFreeze: true, stockAtPost: 130 })],
      {
        status: "posted",
        postedSummary: {
          linesCounted: 1, linesVaried: 1, gainQuantity: 0, lossQuantity: -6,
          gainValue: 0, lossValue: -1980, netValue: -1980, linesMovedSinceFreeze: 1,
        },
      }
    );
    renderSheet();

    expect(screen.getByText(/applied on top of those movements/i)).toBeInTheDocument();
  });

  it("filters to the lines nobody has been to yet", async () => {
    count = sheet([
      line({ _id: "l1", name: "Nylon 70D", countedQty: 100, variance: 0, varianceValue: 0 }),
      line({ _id: "l2", rawMaterial: "m2", name: "Spandex 40D" }),
    ]);
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "Not counted" }));

    expect(screen.getByText("Spandex 40D")).toBeInTheDocument();
    expect(screen.queryByText("Nylon 70D")).not.toBeInTheDocument();
  });

  it("refuses a negative count without sending it", async () => {
    count = sheet([line()]);
    renderSheet();

    const box = screen.getByRole("spinbutton");
    await userEvent.type(box, "-5");
    await userEvent.tab();

    expect(enterMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/zero or more/i), "error");
  });
});
