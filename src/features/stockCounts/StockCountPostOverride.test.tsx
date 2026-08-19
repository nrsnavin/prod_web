import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StockCountDetailPage } from "./StockCountDetailPage";
import { StockCount, StockCountLine } from "./types";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  OVERRIDING A POST THE SERVER OBJECTED TO
//
//  This was a native window.confirm. A stock posting the server has
//  already refused, offered back as an override, in an unstyled
//  operating-system dialog that could not show the lines in question,
//  could not be branded, and could not be tested or read by a screen
//  reader. The severity of the moment and the weight of the interface
//  disagreed completely.
//
//  What these hold:
//
//    • the server's objection is shown in ITS OWN words, not a
//      paraphrase — it is the only thing that explains the refusal;
//    • the lines being left out are LISTED. "12 lines were not counted"
//      does not tell anybody whether the ones that matter are among
//      them, and that is the entire decision;
//    • cancelling posts nothing. An override dialog whose Cancel still
//      commits would be worse than no dialog;
//    • confirming posts once, with force.
// ══════════════════════════════════════════════════════════════════

const enterMutate = vi.fn(async () => ({ count: null }));
const postMutate = vi.fn();
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

const sheet = (lines: StockCountLine[]): StockCount => {
  const counted = lines.filter((l) => l.countedQty !== null);
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
      varied: 0,
      needingReason: 0,
      gainQuantity: 0,
      lossQuantity: 0,
      gainValue: 0,
      lossValue: 0,
      netValue: 0,
    },
  };
};

/** The server's refusal of a partial post, in the words it actually uses. */
const OBJECTION = "3 lines have not been counted. Post the counted lines only?";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/stock-counts/c1"]}>
      <Routes>
        <Route path="/stock-counts/:id" element={<StockCountDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const postBtn = () => screen.getByRole("button", { name: /^post/i });
const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  postMutate.mockReset();
  toast.mockReset();
  count = sheet([
    line({ _id: "l1", name: "Nylon 70D", countedQty: 98, variance: -2 }),
    line({ _id: "l2", name: "Spandex 40D", systemQty: 50 }),
    line({ _id: "l3", name: "Polyester 150D", systemQty: 12 }),
  ]);
  // First attempt refused; a forced attempt succeeds.
  postMutate.mockImplementation(async (force: boolean) => {
    if (!force) throw new ApiError(OBJECTION, 400);
    return { ...count, countNo: 7, postedSummary: { linesVaried: 1, netValue: -660 } };
  });
});

describe("the override dialog", () => {
  it("asks in a real dialog rather than the browser's", async () => {
    renderPage();
    await userEvent.click(postBtn());
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("repeats the server's objection word for word", async () => {
    renderPage();
    await userEvent.click(postBtn());
    expect(await screen.findByText(OBJECTION)).toBeInTheDocument();
  });

  it("lists the lines that will be left out", async () => {
    // The thing a native confirm could not do, and the whole decision.
    renderPage();
    await userEvent.click(postBtn());
    const d = await screen.findByRole("dialog");

    expect(within(d).getByText("Spandex 40D")).toBeInTheDocument();
    expect(within(d).getByText("Polyester 150D")).toBeInTheDocument();
  });

  it("does not list the line that WAS counted", async () => {
    renderPage();
    await userEvent.click(postBtn());
    const d = await screen.findByRole("dialog");
    expect(within(d).queryByText("Nylon 70D")).not.toBeInTheDocument();
  });

  it("says plainly that nothing is written off", async () => {
    // The fear this dialog has to answer: that confirming zeroes the
    // stock of everything nobody got to.
    renderPage();
    await userEvent.click(postBtn());
    expect(await screen.findByText(/nothing is written off/i)).toBeInTheDocument();
  });
});

describe("what each answer does", () => {
  it("posts nothing when it is cancelled", async () => {
    renderPage();
    await userEvent.click(postBtn());
    await screen.findByRole("dialog");
    postMutate.mockClear();

    await userEvent.click(within(dialog()).getByRole("button", { name: /cancel/i }));
    expect(postMutate).not.toHaveBeenCalled();
  });

  it("closes when it is cancelled", async () => {
    renderPage();
    await userEvent.click(postBtn());
    await screen.findByRole("dialog");
    await userEvent.click(within(dialog()).getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("posts once, forced, when it is confirmed", async () => {
    renderPage();
    await userEvent.click(postBtn());
    await screen.findByRole("dialog");
    postMutate.mockClear();

    await userEvent.click(
      within(dialog()).getByRole("button", { name: /post the counted lines/i })
    );

    expect(postMutate).toHaveBeenCalledTimes(1);
    expect(postMutate).toHaveBeenCalledWith(true);
  });

  it("does not ask twice for the same posting", async () => {
    renderPage();
    await userEvent.click(postBtn());
    await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog()).getByRole("button", { name: /post the counted lines/i })
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
