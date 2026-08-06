import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OrderPnlDetailPage } from "./OrderPnlDetailPage";
import type { OrderPnl } from "./types";

// ══════════════════════════════════════════════════════════════════
//  The whole risk with a P&L is a confident number built on inputs
//  nobody recorded. Four of the seven cost lines come off a rate card
//  that starts at zero, and the selling price starts at zero too — so
//  a brand new factory would see a beautiful margin made entirely of
//  blanks. These tests are mostly about the page refusing to do that.
// ══════════════════════════════════════════════════════════════════

const { saveRates, saveOverrides, useOrderPnl } = vi.hoisted(() => ({
  saveRates: vi.fn(),
  saveOverrides: vi.fn(),
  useOrderPnl: vi.fn(),
}));

vi.mock("./hooks", () => ({
  useOrderPnl: (id: string) => useOrderPnl(id),
  usePnlMutations: () => ({
    saveRates: { mutate: saveRates, isPending: false },
    saveOverrides: { mutate: saveOverrides, isPending: false },
    saveSettings: { mutate: vi.fn(), isPending: false },
  }),
  useCostSettings: () => ({ data: undefined, isLoading: false }),
}));

const line = (over = {}) => ({
  elasticId: "e1",
  name: "Elastic 25mm",
  quantity: 1000,
  rate: 40,
  amount: 40000,
  ...over,
});

const job = (over = {}) => ({
  id: "j1",
  jobOrderNo: 42,
  jobNo: "J-42",
  status: "weaving",
  productionMode: "in_house" as const,
  outsourceVendor: "",
  producedMeters: 1000,
  labour: { amount: 1200, shifts: 2, hours: 24, openShifts: 0 },
  jobWork: 0,
  finishing: { amount: 2000, basis: "rate" as const },
  checking: { amount: 1000, basis: "rate" as const },
  packing: { amount: 500, basis: "rate" as const },
  overhead: { amount: 3000, basis: "rate" as const },
  total: 7700,
  costPerMeter: 7.7,
  ...over,
});

const pnl = (over: Partial<OrderPnl> = {}): OrderPnl =>
  ({
    order: {
      id: "o1", orderNo: 91, po: "PO-91", status: "InProgress",
      date: null, supplyDate: null, customerName: "Acme Ltd",
    },
    revenue: {
      lines: [line()],
      orderValue: 40000,
      invoiced: { amount: 0, quantity: 0, challans: 0 },
    },
    costs: {
      material: 9000, labour: 1200, jobWork: 0,
      finishing: 2000, checking: 1000, packing: 500, overhead: 3000,
      total: 16700,
    },
    jobs: [job()],
    totals: {
      producedMeters: 1000, orderedQuantity: 1000,
      profit: 23300, marginPct: 58.25, costPerMeter: 16.7, revenuePerMeter: 40,
    },
    rateCard: {
      finishingRatePerMeter: 2, checkingRatePerMeter: 1,
      packingRatePerMeter: 0.5, overheadRatePerMeter: 3, configured: true,
    },
    materialLines: [
      { name: "Spandex 40D", quantity: 10, unitPrice: 900, amount: 9000, type: "ORDER_APPROVAL" },
    ],
    warnings: [],
    ...over,
  }) as OrderPnl;

function renderPage(data: OrderPnl) {
  useOrderPnl.mockReturnValue({ data, isLoading: false, isError: false });
  render(
    <MemoryRouter initialEntries={["/order-pnl/o1"]}>
      <Routes>
        <Route path="/order-pnl/:id" element={<OrderPnlDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  saveRates.mockClear();
  saveOverrides.mockClear();
  useOrderPnl.mockReset();
});

describe("the bottom line", () => {
  // Several of these figures legitimately appear twice — once in the
  // summary tile, once inside the card that builds them — so each is
  // asserted against its own labelled tile rather than by bare text.
  it("shows value, cost, profit and margin", () => {
    renderPage(pnl());
    const summary = within(screen.getByRole("region", { name: /summary/i }));
    const tile = (label: string) => summary.getByText(label).parentElement!;

    expect(tile("Order value").textContent).toContain("₹40,000");
    expect(tile("Total cost").textContent).toContain("₹16,700");
    expect(tile("Profit").textContent).toContain("₹23,300");
    expect(tile("Margin").textContent).toContain("58.25%");
  });

  it("breaks the cost into the lines it came from", () => {
    renderPage(pnl());
    for (const label of [
      "Yarn issued", "Wages", "Outsourced job-work",
      "Finishing", "Checking", "Packing", "Overhead",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

// The single most important behaviour on the page.
describe("missing inputs", () => {
  it("lists everything the figure is missing, rather than hiding it", () => {
    renderPage(pnl({
      warnings: [
        "No selling rate on 1 of 1 order line(s) (Elastic 25mm) — revenue is understated.",
        "The conversion rate card has never been set, so finishing, checking, packing and overhead are all ₹0. Set it in Settings → Costing.",
      ],
    }));

    const panel = screen.getByText(/What this figure is missing/i).closest("div")!;
    expect(within(panel).getByText(/No selling rate on 1 of 1/)).toBeInTheDocument();
    expect(within(panel).getByText(/rate card has never been set/)).toBeInTheDocument();
  });

  it("says nothing when nothing is missing", () => {
    renderPage(pnl());
    expect(screen.queryByText(/What this figure is missing/i)).not.toBeInTheDocument();
  });

  it("reads an unpriced order as not priced, not as a total loss", () => {
    renderPage(pnl({
      revenue: { lines: [line({ rate: 0, amount: 0 })], orderValue: 0, invoiced: { amount: 0, quantity: 0, challans: 0 } },
      totals: { producedMeters: 1000, orderedQuantity: 1000, profit: -16700, marginPct: null, costPerMeter: 16.7, revenuePerMeter: 0 },
    }));
    expect(screen.getByText("Not priced")).toBeInTheDocument();
    expect(screen.queryByText("-100%")).not.toBeInTheDocument();
  });
});

describe("selling rates", () => {
  it("moves the order value as the rate is typed, before any save", async () => {
    const user = userEvent.setup();
    renderPage(pnl());

    const input = screen.getByLabelText(/Rate ₹\/m/i);
    await user.clear(input);
    await user.type(input, "50");

    // 1000 × 50 — the summary tile still shows the saved 40,000, but the
    // revenue card's own total follows the form.
    expect(screen.getAllByText("₹50,000").length).toBeGreaterThan(0);
  });

  it("posts only the lines that were touched", async () => {
    const user = userEvent.setup();
    renderPage(pnl({
      revenue: {
        lines: [line(), line({ elasticId: "e2", name: "Elastic 50mm" })],
        orderValue: 80000,
        invoiced: { amount: 0, quantity: 0, challans: 0 },
      },
    }));

    const inputs = screen.getAllByLabelText(/Rate ₹\/m/i);
    await user.clear(inputs[1]);
    await user.type(inputs[1], "55");
    await user.click(screen.getByRole("button", { name: /save rates/i }));

    expect(saveRates).toHaveBeenCalledTimes(1);
    expect(saveRates.mock.calls[0][0]).toEqual([{ elastic: "e2", rate: 55 }]);
  });

  it("keeps the invoiced total beside the order value, not instead of it", () => {
    renderPage(pnl({
      revenue: {
        lines: [line()],
        orderValue: 40000,
        invoiced: { amount: 7200, quantity: 400, challans: 1 },
      },
    }));
    expect(screen.getByText(/Invoiced so far \(1 challan\)/)).toBeInTheDocument();
    expect(screen.getByText("₹7,200")).toBeInTheDocument();
  });
});

describe("a job's actual cost", () => {
  it("offers the rate-card figure as the placeholder, so the box stays empty", async () => {
    const user = userEvent.setup();
    renderPage(pnl());
    await user.click(screen.getByRole("button", { name: /costs/i }));

    const finishing = screen.getByLabelText(/Finishing ₹/i);
    expect(finishing).toHaveValue(null);
    expect(finishing).toHaveAttribute("placeholder", "2000 (rate)");
  });

  it("pre-fills the box when the job already carries an override", async () => {
    const user = userEvent.setup();
    renderPage(pnl({ jobs: [job({ finishing: { amount: 3500, basis: "override" } })] }));
    await user.click(screen.getByRole("button", { name: /costs/i }));

    expect(screen.getByLabelText(/Finishing ₹/i)).toHaveValue(3500);
  });

  // Blank and 0 are different answers, and the API treats them
  // differently — blank returns the line to the rate card, 0 asserts the
  // stage genuinely cost nothing.
  it("sends null for a cleared box and 0 for a typed zero", async () => {
    const user = userEvent.setup();
    renderPage(pnl({ jobs: [job({ finishing: { amount: 3500, basis: "override" } })] }));
    await user.click(screen.getByRole("button", { name: /costs/i }));

    await user.clear(screen.getByLabelText(/Finishing ₹/i));
    await user.type(screen.getByLabelText(/Checking ₹/i), "0");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(saveOverrides).toHaveBeenCalledTimes(1);
    expect(saveOverrides.mock.calls[0][0]).toEqual({
      jobId: "j1",
      body: { finishing: null, checking: 0 },
    });
  });

  it("marks an outsourced job with its vendor", () => {
    renderPage(pnl({
      jobs: [job({ productionMode: "outsource", outsourceVendor: "Sunrise Weaving", jobWork: 11280 })],
    }));
    expect(screen.getByText("Sunrise Weaving")).toBeInTheDocument();
    expect(screen.getByText("₹11,280")).toBeInTheDocument();
  });

  it("flags shifts that are still open beside the wage figure", () => {
    renderPage(pnl({
      jobs: [job({ labour: { amount: 1200, shifts: 2, hours: 24, openShifts: 3 } })],
    }));
    expect(screen.getByText(/3 open/)).toBeInTheDocument();
  });
});

describe("yarn issued", () => {
  it("shows the price captured at issue, and calls out a zero one", () => {
    renderPage(pnl({
      materialLines: [
        { name: "Spandex 40D", quantity: 10, unitPrice: 900, amount: 9000, type: "ORDER_APPROVAL" },
        { name: "Mystery Yarn", quantity: 4, unitPrice: 0, amount: 0, type: "ORDER_APPROVAL" },
      ],
    }));
    expect(screen.getByText("₹900.00")).toBeInTheDocument();
    expect(screen.getByText("no price")).toBeInTheDocument();
  });
});

// The statement is a document to file and argue over, so it opens in a
// new tab rather than being fetched — the browser's own viewer gives
// print and save for free.
describe("the printed statement", () => {
  it("links to the PDF for this order, in a new tab", () => {
    renderPage(pnl());
    const link = screen.getByRole("link", { name: /P&L statement/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("/pnl/order/o1.pdf"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });
});

// Number("") is 0, and 0 is this app's signal for "not priced" — so a
// form that sends a cleared box as a number silently un-prices the line
// the planner was only mid-edit on, and answers 200 OK.
describe("a cleared rate box", () => {
  it("is not sent as a price of zero", async () => {
    const user = userEvent.setup();
    renderPage(pnl());
    await user.clear(screen.getByLabelText(/Rate ₹\/m/i));
    await user.click(screen.getByRole("button", { name: /save rates/i }));
    expect(saveRates).not.toHaveBeenCalled();
  });

  it("does not block the other lines from saving", async () => {
    const user = userEvent.setup();
    renderPage(pnl({
      revenue: {
        lines: [line(), line({ elasticId: "e2", name: "Elastic 50mm" })],
        orderValue: 80000,
        invoiced: { amount: 0, quantity: 0, challans: 0 },
      },
    }));
    const inputs = screen.getAllByLabelText(/Rate ₹\/m/i);
    await user.clear(inputs[0]);
    await user.clear(inputs[1]);
    await user.type(inputs[1], "55");
    await user.click(screen.getByRole("button", { name: /save rates/i }));
    expect(saveRates.mock.calls[0][0]).toEqual([{ elastic: "e2", rate: 55 }]);
  });

  // A fat-fingered exponent multiplies out to Infinity on the server.
  it("refuses an absurd rate before the round trip", async () => {
    const user = userEvent.setup();
    renderPage(pnl());
    await user.clear(screen.getByLabelText(/Rate ₹\/m/i));
    await user.type(screen.getByLabelText(/Rate ₹\/m/i), "99999999");
    expect(screen.getByText(/must be between 0 and/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save rates/i })).toBeDisabled();
  });
});
