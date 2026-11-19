import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreditTermsHistory } from "./CreditTermsHistory";

// ══════════════════════════════════════════════════════════════════
//  WHO CHANGED THIS CUSTOMER'S CREDIT TERMS
//
//  The credit limit and the overdue days allowed decide whether an
//  order, a challan or an invoice goes through. Changing them left no
//  trace. The server now keeps each change; this is where it is read —
//  on the customer's own page, beside the terms.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a) } };
});

const show = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CreditTermsHistory customerId="c1" /></QueryClientProvider>);

// In braces: vitest runs whatever beforeEach RETURNS as a teardown, and mockReset() returns the mock.
beforeEach(() => { get.mockReset(); });

describe("a customer's credit terms", () => {
  it("lists each change: when, who, from what to what", async () => {
    get.mockResolvedValue({
      success: true,
      terms: { creditLimit: 1500000, maxOverdueDays: 30, paymentTerms: "45", interestRate: null, interestGraceDays: null },
      history: [
        { at: "2026-11-12T06:30:00Z", by: "Kumar", changes: {}, detail: "Credit limit ₹8,00,000 to ₹15,00,000 · payment terms 30 to 45" },
        { at: "2026-10-03T06:30:00Z", by: "Owner", changes: {}, detail: "Credit limit ₹5,00,000 to ₹8,00,000" },
      ],
    });
    show();

    expect(await screen.findByText("Credit limit ₹8,00,000 to ₹15,00,000 · payment terms 30 to 45")).toBeInTheDocument();
    expect(screen.getByText("Credit limit ₹5,00,000 to ₹8,00,000")).toBeInTheDocument();
    expect(screen.getByText(/12 Nov 2026 · Kumar/)).toBeInTheDocument();
    expect(screen.getByText(/3 Oct 2026 · Owner/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/customer/c1/credit-terms");
  });

  it("is not shown for a customer whose terms nobody has changed", async () => {
    get.mockResolvedValue({ success: true, terms: { creditLimit: 0 }, history: [] });
    const { container } = show();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("is not shown when an older server has no such list", async () => {
    // Rejected when asked, as a 404 from a server without the route is.
    get.mockImplementation(() => Promise.reject(new Error("Not found")));
    const { container } = show();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
