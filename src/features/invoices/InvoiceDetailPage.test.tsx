import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InvoiceDetailPage } from "./InvoiceDetailPage";
import { ApiError } from "@/core/http/httpClient";
import type { Invoice } from "./types";

// ══════════════════════════════════════════════════════════════════
//  AN INVOICE, AND ITS IRN
//
//  Both parties with their GSTINs, the lines with the tax split, the
//  totals. "Register IRN" goes through the connected GSP; with none
//  connected the same button opens the paste dialog; what the portal
//  would refuse is listed. Cancelling needs a reason.
// ══════════════════════════════════════════════════════════════════

let inv: Invoice;
const registerMutate = vi.fn();
const pasteMutate = vi.fn();
const cancelMutate = vi.fn();
vi.mock("./hooks", () => ({
  useInvoice: () => ({ data: inv, isLoading: false, isError: false, error: null }),
  useInvoiceMutations: () => ({
    registerIrn: { mutate: registerMutate, isPending: false },
    pasteIrn: { mutate: pasteMutate, isPending: false },
    cancel: { mutate: cancelMutate, isPending: false },
  }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

const party = { name: "Sunrise Garments", address: "4 Kongu Nagar", city: "Tiruppur", pincode: "641604", stateCode: "33", gstin: "33AAEPS1111F1Z2" };
const base: Invoice = {
  _id: "i1", invoiceNumber: "INV/2026-27/0001", invoiceDate: "2026-07-12", order: "o1", orderNo: 118, customer: "c1", customerPo: "PO-77",
  seller: { ...party, name: "Balu Elastics", gstin: "33AAECB1234F1Z5", city: "Erode", pincode: "638052" },
  buyer: party, supplyType: "intra", placeOfSupply: "33",
  dcs: [{ dc: "d1", dcNumber: "E-26/27-0001" }],
  lines: [{ elastic: "a", name: "20mm Knitted", hsn: "5806", unit: "m", quantity: 1000, rate: 12.5, taxable: 12500, gstPercent: 5, cgst: 312.5, sgst: 312.5, igst: 0, amount: 13125, dcNumbers: ["E-26/27-0001"] }],
  totals: { taxable: 12500, cgst: 312.5, sgst: 312.5, igst: 0, tax: 625, roundOff: 0, grand: 13125 },
  amountInWords: "Rupees Thirteen Thousand One Hundred Twenty Five Only",
  status: "issued", einvoice: { status: "pending" }, einvoiceProblems: [],
  fingerprints: [{ code: "INVOICE_CREATED", label: "Invoice Raised", at: "2026-07-12T10:00:00Z", actor: { name: "Owner" } }],
};

const open = () => render(
  <MemoryRouter initialEntries={["/invoices/i1"]}>
    <Routes><Route path="/invoices/:id" element={<InvoiceDetailPage />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => {
  inv = base;
  registerMutate.mockReset();
  pasteMutate.mockReset();
  cancelMutate.mockReset();
  toast.mockReset();
});

describe("the invoice page", () => {
  it("shows both parties, the tax split and the totals", () => {
    open();
    expect(screen.getByText("GSTIN 33AAECB1234F1Z5")).toBeInTheDocument();
    expect(screen.getByText("GSTIN 33AAEPS1111F1Z2")).toBeInTheDocument();
    expect(screen.getAllByText("Tamil Nadu (33)").length).toBeGreaterThan(0);
    expect(screen.getByText("CGST + SGST · in-state")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "E-26/27-0001" })).toHaveAttribute("href", "/delivery-challans/d1");
    expect(screen.getByRole("link", { name: "#118" })).toHaveAttribute("href", "/orders/o1");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("Total₹13,125.00");
    expect(screen.getByText("Rupees Thirteen Thousand One Hundred Twenty Five Only")).toBeInTheDocument();
    expect(screen.getByText("IRN pending")).toBeInTheDocument();
  });

  it("with no GSP connected, Register IRN opens the paste dialog, and the pasted IRN is sent", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: /register irn/i }));
    expect(registerMutate).toHaveBeenCalledWith("i1", expect.anything());
    registerMutate.mock.calls[0][1].onError(new ApiError("No e-invoice provider is connected.", 409, undefined, "EINVOICE_NOT_CONFIGURED"));
    expect(await screen.findByText("Paste the IRN for INV/2026-27/0001")).toBeInTheDocument();
    const irn = "a".repeat(64);
    await userEvent.type(screen.getByLabelText("IRN"), irn);
    await userEvent.type(screen.getByLabelText("Ack no."), "112010012345678");
    await userEvent.click(screen.getByRole("button", { name: /save irn/i }));
    expect(pasteMutate).toHaveBeenCalledWith({ id: "i1", body: expect.objectContaining({ irn, ackNo: "112010012345678" }) }, expect.anything());
  });

  it("lists what the portal would refuse when registration is refused for it", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: /register irn/i }));
    registerMutate.mock.calls[0][1].onError(new ApiError("not ready", 409, undefined, "EINVOICE_NOT_READY", { details: { problems: ["Sunrise Garments has no PIN code on the customer record."] } }));
    expect(await screen.findByText("Sunrise Garments has no PIN code on the customer record.")).toBeInTheDocument();
  });

  it("a registered invoice shows its IRN and offers no registration", () => {
    inv = { ...base, einvoice: { status: "registered", irn: "b".repeat(64), ackNo: "112010012345678", ackDate: "2026-07-12T10:30:00Z", provider: "manual", signedQr: "x" } };
    open();
    expect(screen.getByText("b".repeat(64))).toBeInTheDocument();
    expect(screen.getByText("Pasted from the portal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /register irn/i })).not.toBeInTheDocument();
    expect(screen.getByText("IRN registered")).toBeInTheDocument();
  });

  it("cancelling needs a reason of 8 characters, and relays the portal note", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const box = await screen.findByRole("textbox");
    await userEvent.type(box, "Wrong rate agreed");
    await userEvent.click(screen.getByRole("button", { name: /cancel invoice/i }));
    expect(cancelMutate).toHaveBeenCalledWith({ id: "i1", reason: "Wrong rate agreed" }, expect.anything());
    cancelMutate.mock.calls[0][1].onSuccess({ portalNote: "Cancel it on the portal too." });
    expect(toast).toHaveBeenCalledWith("Invoice cancelled. Cancel it on the portal too.", "info");
  });

  it("a cancelled invoice says why and offers nothing", () => {
    inv = { ...base, status: "cancelled", cancel: { reason: "Wrong rate agreed" } };
    open();
    expect(screen.getByText("Cancelled: Wrong rate agreed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /register irn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
  });
});
