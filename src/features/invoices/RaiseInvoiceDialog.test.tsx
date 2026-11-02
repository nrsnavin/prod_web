import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RaiseInvoiceDialog } from "./RaiseInvoiceDialog";
import type { InvoiceOrderInfo } from "./types";

// ══════════════════════════════════════════════════════════════════
//  RAISING AN INVOICE FROM THE ORDER
//
//  The challans that have left come ticked; one already invoiced says
//  on which and cannot be ticked. The lines follow the ticks, the
//  rate can be typed over, and what goes to the server is the ticked
//  challans plus only the lines that were changed.
// ══════════════════════════════════════════════════════════════════

const createMutate = vi.fn();
const navigate = vi.fn();
let info: InvoiceOrderInfo;
vi.mock("./hooks", () => ({
  useInvoiceOrderInfo: () => ({ data: info, isLoading: false, isError: false, error: null }),
  useInvoiceMutations: () => ({ create: { mutate: createMutate, isPending: false } }),
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const party = { name: "Sunrise Garments", address: "4 Kongu Nagar", city: "Tiruppur", pincode: "641604", stateCode: "33", gstin: "33AAEPS1111F1Z2" };

beforeEach(() => {
  createMutate.mockReset();
  navigate.mockReset();
  toast.mockReset();
  info = {
    order: { _id: "o1", orderNo: 118, po: "PO-77" },
    seller: { ...party, name: "Balu Elastics", gstin: "33AAECB1234F1Z5" },
    buyer: party,
    shipTo: "4 Kongu Nagar, Tiruppur - 641604",
    supplyType: "intra",
    placeOfSupply: "33",
    dcs: [
      { _id: "d1", dcNumber: "E-26/27-0001", status: "dispatched", dispatchDate: "2026-07-10", totalQuantity: 600, invoicedOn: null, eligible: true, items: [{ elastic: "a", elasticName: "20mm Knitted", quantity: 600, unit: "m" }] },
      { _id: "d2", dcNumber: "E-26/27-0002", status: "delivered", dispatchDate: "2026-07-11", totalQuantity: 400, invoicedOn: null, eligible: true, items: [{ elastic: "a", elasticName: "20mm Knitted", quantity: 400, unit: "m" }] },
      { _id: "d0", dcNumber: "E-26/27-0000", status: "dispatched", dispatchDate: "2026-07-01", totalQuantity: 100, invoicedOn: "INV/2026-27/0001", eligible: false, items: [] },
      { _id: "d3", dcNumber: "E-26/27-0003", status: "draft", totalQuantity: 50, invoicedOn: null, eligible: false, items: [] },
    ],
    lines: [{ elastic: "a", name: "20mm Knitted", unit: "m", quantity: 1000, rate: 12.5, hsn: "5806", gstPercent: 5, dcNumbers: ["E-26/27-0001", "E-26/27-0002"], rateSource: "order" }],
    defaults: { hsn: "5806", gstPercent: 5 },
    problems: [],
  };
});

const open = () => render(
  <MemoryRouter>
    <RaiseInvoiceDialog orderId="o1" onClose={() => {}} />
  </MemoryRouter>
);

describe("raising an invoice", () => {
  it("ticks the challans that can go on it, and says why the others cannot", () => {
    open();
    expect(screen.getByLabelText("Include E-26/27-0001")).toBeChecked();
    expect(screen.getByLabelText("Include E-26/27-0002")).toBeChecked();
    expect(screen.getByLabelText("Include E-26/27-0000")).toBeDisabled();
    expect(screen.getByText("on INV/2026-27/0001")).toBeInTheDocument();
    expect(screen.getByLabelText("Include E-26/27-0003")).toBeDisabled();
    expect(screen.getByText("CGST + SGST — in-state")).toBeInTheDocument();
    // 1,000 × 12.50 = 12,500 at 5% → 13,125
    const totals = screen.getByLabelText("Invoice totals");
    expect(totals).toHaveTextContent("Taxable value12,500.00");
    expect(totals).toHaveTextContent("CGST312.50");
    expect(totals).toHaveTextContent("Total₹13,125.00");
  });

  it("the lines follow the ticks and the typed rate, and only what changed goes to the server", async () => {
    open();
    await userEvent.click(screen.getByLabelText("Include E-26/27-0002"));
    // The challan row and the line both say 600 m now; the 1,000 m line is gone.
    expect(screen.getAllByText("600 m")).toHaveLength(2);
    expect(screen.queryByText("1,000 m")).not.toBeInTheDocument();
    const rate = screen.getByLabelText("Rate for 20mm Knitted");
    await userEvent.clear(rate);
    await userEvent.type(rate, "10");
    expect(screen.getByLabelText("Invoice totals")).toHaveTextContent("Total₹6,300.00");

    await userEvent.click(screen.getByRole("button", { name: /raise invoice/i }));
    expect(createMutate).toHaveBeenCalledTimes(1);
    const body = createMutate.mock.calls[0][0];
    expect(body).toMatchObject({ orderId: "o1", dcIds: ["d1"], lines: [{ elastic: "a", rate: 10 }] });
    createMutate.mock.calls[0][1].onSuccess({ _id: "i9", invoiceNumber: "INV/2026-27/0002" });
    expect(toast).toHaveBeenCalledWith("Invoice INV/2026-27/0002 raised", "success");
    expect(navigate).toHaveBeenCalledWith("/invoices/i9");
  });

  it("refuses to raise with an unpriced line, and names it", async () => {
    info = { ...info, lines: [{ ...info.lines[0], rate: 0, rateSource: "none" }] };
    open();
    expect(screen.getByRole("button", { name: /raise invoice/i })).toBeDisabled();
    expect(screen.getByText(/No rate for 20mm Knitted/)).toBeInTheDocument();
  });

  it("warns what the portal will refuse, without blocking the invoice", () => {
    info = { ...info, problems: ["Sunrise Garments has no PIN code on the customer record."] };
    open();
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Sunrise Garments has no PIN code on the customer record.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /raise invoice/i })).toBeEnabled();
  });
});
