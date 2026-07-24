import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerOrdersCard } from "./CustomerOrdersCard";

const orders = vi.fn();
vi.mock("./api", () => ({
  customerService: { orders: (id: string) => orders(id) },
}));

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CustomerOrdersCard customerId="c1" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CustomerOrdersCard", () => {
  it("lists running and past orders, linked to the order detail page", async () => {
    orders.mockResolvedValue({
      running: [{ _id: "o1", orderNo: 101, po: "PO-9", status: "Open" }],
      past: [{ _id: "o2", orderNo: 88, status: "Completed" }],
      pastTotal: 5,
      hasMore: true,
    });

    renderCard();

    const running = await screen.findByText("#101");
    // Row links to the order detail page.
    expect(running.closest("a")).toHaveAttribute("href", "/orders/o1");
    expect(screen.getByText("#88").closest("a")).toHaveAttribute("href", "/orders/o2");
    // Section headers reflect counts.
    expect(screen.getByText(/Running \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Recent past \(5\)/)).toBeInTheDocument();
  });

  it("shows an empty state when the customer has no orders", async () => {
    orders.mockResolvedValue({ running: [], past: [], pastTotal: 0, hasMore: false });
    renderCard();
    expect(await screen.findByText(/No orders for this customer/i)).toBeInTheDocument();
  });
});
