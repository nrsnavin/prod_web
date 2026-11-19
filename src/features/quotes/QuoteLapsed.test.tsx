import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ymd } from "@/core/format/date";
import { isLapsed } from "./validity";
import { QuoteListPage } from "./QuoteListPage";
import { QuoteDetailPage } from "./QuoteDetailPage";
import type { Quote, QuoteStatus } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHEN A QUOTE HAS RUN OUT
//
//  "Valid until 30 November" is good through 30 November. The date is
//  kept as that day, which as a moment is half past five that morning
//  in India — and the list and the page compared it with the clock. So
//  from 05:30 on its last day a quote read "this price has lapsed", in
//  red, while the customer could still hold the factory to it.
//
//  The list also painted an ACCEPTED quote's date red once the date had
//  passed, though the page for the same quote (rightly) said nothing:
//  the customer said yes inside the window.
//
//  And nothing could list the quotes that had run out — no screen sets
//  the "expired" status, so there was no filter for it here at all.
// ══════════════════════════════════════════════════════════════════

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  // As the server keeps a calendar day: its UTC midnight.
  return `${ymd(d)}T00:00:00.000Z`;
};

let seq = 0;
const quote = (over: Partial<Quote> = {}): Quote => {
  seq += 1;
  return {
    _id: `q${seq}`, quoteNo: `QT-26/27-${String(seq).padStart(4, "0")}`, financialYear: "26/27", sequence: seq,
    date: day(-30), validTill: day(0), customerName: "Ravi Textiles",
    lines: [], gstPercent: 5, subTotal: 0, gstAmount: 0, grandTotal: 0, totalQuantityMetres: 0,
    status: "sent", ...over,
  };
};

describe("isLapsed", () => {
  it("a quote is good through its last day", () => {
    // Before: lapsed from 05:30 that morning.
    expect(isLapsed(quote({ validTill: day(0) }))).toBe(false);
    expect(isLapsed(quote({ validTill: day(1) }))).toBe(false);
  });

  it("and has run out the day after", () => {
    expect(isLapsed(quote({ validTill: day(-1) }))).toBe(true);
  });

  it("reads the day, whatever the hour stored with it", () => {
    // An older quote, dated to the minute it was raised.
    const d = new Date();
    expect(isLapsed(quote({ validTill: `${ymd(d)}T03:10:00.000Z` }))).toBe(false);
  });

  it("is about a price still on offer: not one accepted, declined or withdrawn", () => {
    for (const status of ["accepted", "declined", "cancelled"] as QuoteStatus[]) {
      expect(isLapsed(quote({ status, validTill: day(-10) }))).toBe(false);
    }
    expect(isLapsed(quote({ status: "draft", validTill: day(-10) }))).toBe(true);
  });

  it("a quote marked expired has run out, whatever its date", () => {
    expect(isLapsed(quote({ status: "expired", validTill: day(5) }))).toBe(true);
  });

  it("says nothing of a quote with no date", () => {
    expect(isLapsed(quote({ validTill: "" }))).toBe(false);
  });
});

// ── The screens ─────────────────────────────────────────────────────
let listed: Quote[] = [];
let shown: Quote | undefined;
const asked = vi.fn();
vi.mock("./hooks", () => ({
  useQuotes: (params: unknown) => {
    asked(params);
    return { data: { quotes: listed, total: listed.length, page: 1 }, isLoading: false, isError: false, error: null };
  },
  useQuote: () => ({ data: shown, isLoading: false, isError: false, error: null }),
  useQuoteMutations: () => ({ setStatus: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("./WinLossPanel", () => ({ WinLossPanel: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeEach(() => { listed = []; shown = undefined; asked.mockClear(); });

const renderList = () => render(<MemoryRouter><QuoteListPage /></MemoryRouter>);
const renderDetail = (q: Quote) => {
  shown = q;
  return render(
    <MemoryRouter initialEntries={[`/quotes/${q._id}`]}>
      <Routes><Route path="/quotes/:id" element={<QuoteDetailPage />} /></Routes>
    </MemoryRouter>
  );
};
/** The "Valid till" cell of the row for a quote. */
const validCell = (q: Quote) => {
  const row = screen.getByText(q.quoteNo).closest("tr")!;
  return row.querySelector("span.text-status-danger");
};

describe("the list", () => {
  it("does not mark a quote on its last day", () => {
    const lastDay = quote({ validTill: day(0) });
    const ranOut = quote({ validTill: day(-1) });
    listed = [lastDay, ranOut];
    renderList();
    // Before: both in red.
    expect(validCell(lastDay)).toBeNull();
    expect(validCell(ranOut)).not.toBeNull();
  });

  it("does not mark an accepted quote whose date has passed", () => {
    const won = quote({ status: "accepted", validTill: day(-20) });
    listed = [won];
    renderList();
    expect(validCell(won)).toBeNull();
  });

  it("can be asked for the quotes that have run out", async () => {
    const u = userEvent.setup();
    renderList();
    // Before: no such filter.
    await u.click(screen.getByRole("button", { name: "Lapsed" }));
    expect(asked).toHaveBeenLastCalledWith(expect.objectContaining({ status: "expired", page: 1 }));
  });
});

describe("the quote's page", () => {
  it("does not say the price has lapsed on its last day", () => {
    renderDetail(quote({ validTill: day(0) }));
    // Before: "this price has lapsed", from 05:30 that morning.
    expect(screen.queryByText(/this price has lapsed/)).not.toBeInTheDocument();
  });

  it("says so the day after", () => {
    renderDetail(quote({ validTill: day(-1) }));
    expect(screen.getByText(/this price has lapsed/)).toBeInTheDocument();
  });

  it("says nothing for a quote the customer accepted (unchanged)", () => {
    renderDetail(quote({ status: "accepted", validTill: day(-30) }));
    expect(screen.queryByText(/this price has lapsed/)).not.toBeInTheDocument();
  });
});
