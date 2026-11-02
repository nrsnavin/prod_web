import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OrderInvoices } from "./OrderInvoices";
import type { OrderInvoices as Data } from "@/features/invoices/types";

// ══════════════════════════════════════════════════════════════════
//  THE INVOICES RAISED FOR AN ORDER, ON THE ORDER'S PAGE
//
//  Each invoice linked, with its IRN state; a cancelled one dimmed and
//  out of the total; the "Raise invoice" button only while a
//  despatched challan is not on an invoice yet, and only for someone
//  who can open Invoices.
// ══════════════════════════════════════════════════════════════════

let data: Data | undefined;
let features: string[] = ["/orders", "/invoices"];
vi.mock("@/features/invoices/hooks", () => ({ useOrderInvoices: () => ({ data, isLoading: false }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "accounts", department: "finance", features } }) }));
const dialog = vi.fn(() => <div>raise dialog</div>);
vi.mock("@/features/invoices/RaiseInvoiceDialog", () => ({ RaiseInvoiceDialog: (p: unknown) => dialog(p) }));

const make = (over: Partial<Data> = {}): Data => ({
  invoices: [
    { _id: "i1", invoiceNumber: "INV/2026-27/0001", invoiceDate: "2026-07-12", orderNo: 118, status: "issued", supplyType: "intra", totals: { taxable: 24500, cgst: 1032.5, sgst: 1032.5, igst: 0, tax: 2065, roundOff: 0, grand: 26565 }, dcs: [{ dc: "d1", dcNumber: "E-26/27-0001" }], einvoice: { status: "registered" }, lines: [{ name: "20mm Knitted", quantity: 1000, unit: "m" }] },
    { _id: "i0", invoiceNumber: "INV/2026-27/0000", invoiceDate: "2026-07-01", orderNo: 118, status: "cancelled", supplyType: "intra", totals: { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, roundOff: 0, grand: 100 }, dcs: [], einvoice: { status: "pending" } },
  ],
  totals: { count: 2, cancelled: 1, invoiced: 26565, registered: 1 },
  uninvoicedDcs: [{ _id: "d2", dcNumber: "E-26/27-0002", totalQuantity: 400 }],
  ...over,
});

const renderCard = () => render(
  <MemoryRouter>
    <OrderInvoices orderId="o1" />
  </MemoryRouter>
);

beforeEach(() => {
  data = make();
  features = ["/orders", "/invoices"];
  dialog.mockClear();
});

describe("the invoices card", () => {
  it("links each invoice, shows its IRN state and the total invoiced", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "INV/2026-27/0001" })).toHaveAttribute("href", "/invoices/i1");
    expect(screen.getByText("IRN registered")).toBeInTheDocument();
    expect(screen.getByText("₹26,565.00 invoiced")).toBeInTheDocument();
    expect(screen.getByText("1 cancelled")).toBeInTheDocument();
    expect(screen.getByText(/E-26\/27-0001 · 20mm Knitted 1000m/)).toBeInTheDocument();
  });

  it("offers to raise one while a despatched challan is not invoiced, and opens the dialog", async () => {
    renderCard();
    expect(screen.getByText("Not invoiced yet: E-26/27-0002")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /raise invoice/i }));
    expect(screen.getByText("raise dialog")).toBeInTheDocument();
    expect(dialog).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o1" }));
  });

  it("offers nothing to raise when every challan is invoiced, or to someone without Invoices", () => {
    data = make({ uninvoicedDcs: [] });
    const { unmount } = renderCard();
    expect(screen.queryByRole("button", { name: /raise invoice/i })).not.toBeInTheDocument();
    unmount();
    data = make();
    features = ["/orders"];
    renderCard();
    expect(screen.queryByRole("button", { name: /raise invoice/i })).not.toBeInTheDocument();
  });

  it("says when there is nothing yet", () => {
    data = make({ invoices: [], totals: { count: 0, cancelled: 0, invoiced: 0, registered: 0 }, uninvoicedDcs: [] });
    renderCard();
    expect(screen.getByText("No invoice yet")).toBeInTheDocument();
    expect(screen.getByText(/An invoice can be raised once a challan has been despatched/)).toBeInTheDocument();
  });
});
