import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { OrderBookReportPage } from "./OrderBookReportPage";
import type { OrderBookReport } from "./types";

// The tile that read "Pending (m)" showed the metres no job had been
// raised for. A book planned onto jobs in full and not yet made said 0.
// What is still owed leads now; the unplanned part sits under it, named.

const orderBook = vi.fn();
vi.mock("./api", () => ({ reportsService: { orderBook: () => orderBook(), download: vi.fn() } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/ui/LazyChart", () => ({ lazyChart: () => () => null }));

const report = (summary: Partial<OrderBookReport["summary"]>): OrderBookReport =>
  ({
    range: { from: "2026-11-01", to: "2026-12-01" },
    rangeLabel: "November 2026",
    groupBy: "customer",
    summary: {
      orders: 12, orderedQty: 150000, pendingQty: 4000, openOrders: 9, completedOrders: 3,
      overdueOrders: 2, onTimePct: 80, otdConsidered: 10, ...summary,
    },
    columns: [
      { key: "label", header: "Customer", format: "text" },
      { key: "toDeliverQty", header: "Still to deliver", format: "number" },
      { key: "pendingQty", header: "Not yet planned", format: "number" },
    ],
    rows: [{ key: "c1", label: "Acme", toDeliverQty: 96000, pendingQty: 4000 }],
    series: [],
    seriesKey: "quantity",
  }) as unknown as OrderBookReport;

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OrderBookReportPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("the order book report's headline figures", () => {
  beforeEach(() => orderBook.mockReset());

  it("leads with what is still to deliver, and names the unplanned part", async () => {
    orderBook.mockResolvedValue(report({ toDeliverQty: 96000 }));
    renderPage();
    expect(await screen.findByText("Still to deliver (m)")).toBeInTheDocument();
    // On the tile, and again on the customer's row below.
    expect(screen.getAllByText("96,000").length).toBeGreaterThan(0);
    expect(screen.getByText("4,000 not yet planned")).toBeInTheDocument();
    expect(screen.queryByText("Pending (m)")).not.toBeInTheDocument();
  });

  it("a book planned in full shows what is owed, not zero", async () => {
    orderBook.mockResolvedValue(report({ toDeliverQty: 150000, pendingQty: 0 }));
    renderPage();
    expect(await screen.findByText("Still to deliver (m)")).toBeInTheDocument();
    expect(screen.getByText("0 not yet planned")).toBeInTheDocument();
  });

  it("an older server's figure is shown under its true name", async () => {
    orderBook.mockResolvedValue(report({}));
    renderPage();
    expect(await screen.findByText("Not yet planned (m)")).toBeInTheDocument();
    expect(screen.queryByText("Still to deliver (m)")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending (m)")).not.toBeInTheDocument();
  });
});
