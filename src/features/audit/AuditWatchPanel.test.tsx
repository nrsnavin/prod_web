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
