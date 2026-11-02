import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerRecentCard } from "./CustomerRecentCard";
import type { CustomerRecent } from "./api";

// The customer's recent challans and invoices, each linked, with what
// has been invoiced in all.

const recent = vi.fn();
vi.mock("./api", () => ({ customerService: { recent: (id: string) => recent(id) } }));

const data: CustomerRecent = {
  orders: [], orderTotal: 1,
  dcs: [{ _id: "d1", dcNumber: "E-26/27-0001", status: "dispatched", dispatchDate: "2026-07-10", totalQuantity: 600, orderNo: 118 }],
  dcTotal: 1,
  invoices: [{ _id: "i1", invoiceNumber: "INV/2026-27/0001", invoiceDate: "2026-07-12", status: "issued", totals: { grand: 13125 }, einvoice: { status: "registered" }, orderNo: 118 }],
  invoiceTotal: 1,
  invoiced: { amount: 13125, count: 1 },
};

const open = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><CustomerRecentCard customerId="c1" /></MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => recent.mockReset());

describe("the customer's recent paperwork", () => {
  it("links the challans and invoices and adds up what was invoiced", async () => {
    recent.mockResolvedValue(data);
    open();
    expect(await screen.findByRole("link", { name: /E-26\/27-0001/ })).toHaveAttribute("href", "/delivery-challans/d1");
    expect(screen.getByText(/10 Jul 2026 · Order #118 · 600 m/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /INV\/2026-27\/0001/ })).toHaveAttribute("href", "/invoices/i1");
    expect(screen.getByText("₹13,125.00 invoiced on 1 issued invoice")).toBeInTheDocument();
    expect(screen.getByText("IRN registered")).toBeInTheDocument();
    expect(recent).toHaveBeenCalledWith("c1");
  });

  it("says when there is nothing yet", async () => {
    recent.mockResolvedValue({ ...data, dcs: [], dcTotal: 0, invoices: [], invoiceTotal: 0, invoiced: { amount: 0, count: 0 } });
    open();
    expect(await screen.findByText("Nothing despatched to this customer yet.")).toBeInTheDocument();
    expect(screen.getByText("No invoice raised for this customer yet.")).toBeInTheDocument();
  });
});
