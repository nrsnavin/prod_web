import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuditWatchPanel } from "./AuditWatchPanel";

// The changes worth a second look, each with who, when, and the document.

const get = vi.fn();
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...a) } }));

const items = [
  { kind: "cancelled", severity: "check", title: "Invoice INV-101 cancelled", detail: "Reason: Wrong rate", at: "2026-11-07T10:00:00Z", actor: "Kumar", entityType: "Invoice", entityId: "i1", entityNo: "INV-101" },
  { kind: "late-night", severity: "check", title: "Ravi made 1 change between 10 pm and 5 am", detail: "", at: "2026-11-07T18:00:00Z", actor: "Ravi", entityType: null, entityId: null, entityNo: null },
  { kind: "stock", severity: "info", title: "Stock count posted", detail: "", at: "2026-11-06T10:00:00Z", actor: "Mani", entityType: "StockCount", entityId: "s1", entityNo: 4 },
];

const more = [
  { kind: "credit", severity: "check", title: "Credit terms changed: Sri Lakshmi Garments", detail: "Credit limit ₹5,00,000 to ₹15,00,000", at: "2026-11-07T10:00:00Z", actor: "Kumar", entityType: "Customer", entityId: "c1", entityNo: "Sri Lakshmi Garments" },
  { kind: "stock", severity: "check", title: "Nylon 70D: 12.5 kg written off by hand", detail: "Reason: Damaged in the rain · worth ₹3,750", at: "2026-11-07T09:00:00Z", actor: "Mani", entityType: "RawMaterial", entityId: "m1", entityNo: "Nylon 70D" },
  { kind: "pay", severity: "check", title: "Pay rate changed: Selvi", detail: "₹80/h to ₹95/h", at: "2026-11-06T09:00:00Z", actor: "Kumar", entityType: "Employee", entityId: "e1", entityNo: "Selvi" },
];

describe("credit terms, hand write-offs and pay on the list", () => {
  it("each opens the record it is about, under a heading in words", async () => {
    get.mockResolvedValue({ data: { from: "", to: "", counts: { credit: 1, stock: 1, pay: 1 }, total: 3, toLookAt: 3, items: more } });
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><AuditWatchPanel /></QueryClientProvider></MemoryRouter>);

    expect(await screen.findByRole("link", { name: "Credit terms changed: Sri Lakshmi Garments" })).toHaveAttribute("href", "/customers/c1");
    // Before: plain text — the list named a material and a person, and opened neither.
    expect(screen.getByRole("link", { name: "Nylon 70D: 12.5 kg written off by hand" })).toHaveAttribute("href", "/materials/m1");
    expect(screen.getByRole("link", { name: "Pay rate changed: Selvi" })).toHaveAttribute("href", "/employees/e1");
    // Before: the filter chip for pay read "pay 1".
    expect(screen.getByRole("button", { name: "Credit terms 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay 1" })).toBeInTheDocument();
  });
});

describe("AuditWatchPanel", () => {
  it("lists what to look at, linked to the document, and filters by kind", async () => {
    get.mockResolvedValue({ data: { from: "", to: "", counts: { cancelled: 1, "late-night": 1, stock: 1 }, total: 3, toLookAt: 2, items } });
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><AuditWatchPanel /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByText("2 changes worth a second look")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invoice INV-101 cancelled" })).toHaveAttribute("href", "/invoices/i1");
    expect(screen.getByText("Reason: Wrong rate")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /late at night 1/i }));
    expect(screen.queryByText("Invoice INV-101 cancelled")).not.toBeInTheDocument();
    expect(screen.getByText(/Ravi made 1 change/)).toBeInTheDocument();
  });
});
