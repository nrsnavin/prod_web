import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InvoiceDetailPage } from "./InvoiceDetailPage";
import type { Invoice } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE INVOICE'S ONE NEXT STEP
//
//  The header leads with what the invoice needs next, in the order the
//  portal and the money ask for it: the IRN, then the e-way bill the
//  goods move under (above ₹50,000), then the payment. The rest sit
//  under More, still there for the odd case.
// ══════════════════════════════════════════════════════════════════

let inv: Invoice;
vi.mock("./hooks", () => ({
  useInvoice: () => ({ data: inv, isLoading: false, isError: false, error: null }),
  useInvoiceMutations: () => ({
    registerIrn: { mutate: vi.fn(), isPending: false },
    pasteIrn: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));
const user = { _id: "u1", name: "Owner", role: "admin", department: "admin" };
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));

const party = { name: "Sunrise Garments", address: "4 Kongu Nagar", city: "Tiruppur", pincode: "641604", stateCode: "33", gstin: "33AAEPS1111F1Z2" };
const big = { taxable: 60000, cgst: 1500, sgst: 1500, igst: 0, tax: 3000, roundOff: 0, grand: 63000 };
const base: Invoice = {
  _id: "i1", invoiceNumber: "INV/2026-27/0001", invoiceDate: "2026-07-12", order: "o1", orderNo: 118, customer: "c1",
  seller: { ...party, name: "Balu Elastics", gstin: "33AAECB1234F1Z5" }, buyer: party, supplyType: "intra", placeOfSupply: "33",
  dcs: [], lines: [], totals: big, amountInWords: "", status: "issued",
  einvoice: { status: "registered", irn: "b".repeat(64), ackNo: "1", ackDate: "2026-07-12T10:30:00Z", provider: "manual" },
  einvoiceProblems: [],
};

const open = () => render(
  <MemoryRouter initialEntries={["/invoices/i1"]}>
    <Routes><Route path="/invoices/:id" element={<InvoiceDetailPage />} /></Routes>
  </MemoryRouter>
);

// The header's buttons, before More is opened: the primary is last.
const headerButtons = () => screen.getAllByRole("button").map((b) => b.textContent?.trim());

beforeEach(() => { inv = base; });

describe("the invoice leads with its next step", () => {
  it("an IRN still to register comes first", () => {
    inv = { ...base, einvoice: { status: "pending" } };
    open();
    expect(screen.getByRole("button", { name: "Register IRN…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "E-way bill…" })).not.toBeInTheDocument();
  });

  it("then the e-way bill, when the goods are worth more than ₹50,000", async () => {
    open();
    expect(screen.getByRole("button", { name: "E-way bill…" })).toBeInTheDocument();
    // Not offered twice.
    await userEvent.click(screen.getByRole("button", { name: /more/i }));
    expect(screen.queryByRole("menuitem", { name: "E-way bill…" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Record receipt…" })).toBeInTheDocument();
  });

  it("then the payment, while money is owed", () => {
    inv = { ...base, totals: { ...big, grand: 13125 } };
    open();
    expect(headerButtons()).toContain("Record receipt…");
    expect(screen.queryByRole("button", { name: "E-way bill…" })).not.toBeInTheDocument();
  });

  it("and nothing leads once it is paid; receipts stay under More", async () => {
    inv = { ...base, totals: { ...big, grand: 13125 }, paidAmount: 13125 };
    open();
    expect(screen.queryByRole("button", { name: "Record receipt…" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /more/i }));
    expect(screen.getByRole("menuitem", { name: "Record receipt…" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "E-way bill…" })).toBeInTheDocument();
  });
});
