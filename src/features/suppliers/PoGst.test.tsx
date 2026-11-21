import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PoCreatePage } from "./PoCreatePage";
import { PoDocument } from "./PoDocument";
import { lineGst, noGstReason, pricePoLines, purchaseTaxSettings } from "./poTax";
import type { PurchaseOrder } from "./types";

// ══════════════════════════════════════════════════════════════════
//  GST ON A PURCHASE ORDER
//
//  Each line takes its material's HSN and rate (else the default in
//  Settings), either typed over at will, and the form shows the tax the
//  way the supplier's bill will charge it — worked out as the server
//  works it out (prod/services/purchaseTax.js). The printed PO sets it
//  out under the taxable value.
// ══════════════════════════════════════════════════════════════════

vi.mock("./api", () => ({
  priceListService: { check: async () => [] },
  supplierService: { list: async () => ({ suppliers: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }) },
}));
vi.mock("@/features/materials/hooks", () => ({
  useMaterials: () => ({ isLoading: false, data: [
    { _id: "m1", name: "Nylon 70D", category: "warp", unit: "kg", hsn: "5402", gstPercent: 5 },
    { _id: "m2", name: "Rubber thread", category: "Rubber", unit: "kg", hsn: "", gstPercent: null },
  ] }),
}));
// Our GSTIN is Tamil Nadu's, and the default rate 12% — so a line on the
// default is told apart from one at its material's 5%.
vi.mock("@/features/settings/hooks", () => ({
  useDocumentSettings: () => ({ data: { companyName: "Balu Elastics", gstin: "33AABFB1234C1Z5", addressLines: [], invoice: { defaultGstPercent: 12, stateCode: "" } } }),
}));
const createPo = vi.fn();
vi.mock("./hooks", () => ({ usePoMutations: () => ({ create: { mutate: createPo, isPending: false } }) }));
vi.mock("@/components/ui/UnsavedChangesGuard", () => ({ UnsavedChangesGuard: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeEach(() => createPo.mockReset());

const openForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: "/purchase-orders/new", state: { prefill: {
        supplier: "s1", supplierName: "Sri Yarn Traders",
        items: [{ rawMaterial: "m1", quantity: 100, price: 320 }, { rawMaterial: "m2", quantity: 10, price: 900 }],
      } } }]}>
        <PoCreatePage />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("the purchase order form", () => {
  it("fills each line's HSN and rate from its material, else the default, and shows the tax", async () => {
    openForm();
    const hsn = screen.getAllByLabelText("HSN") as HTMLInputElement[];
    const gst = screen.getAllByLabelText("GST %") as HTMLInputElement[];
    await waitFor(() => expect(gst.map((g) => g.value)).toEqual(["5", "12"]));
    expect(hsn.map((h) => h.value)).toEqual(["5402", ""]);

    // 32,000 at 5% and 9,000 at 12%: 1,600 + 1,080 of tax, split in two.
    expect(screen.getByText("Taxable value").nextSibling).toHaveTextContent("₹41,000.00");
    expect(screen.getByText("CGST").nextSibling).toHaveTextContent("₹1,340.00");
    expect(screen.getByText("SGST").nextSibling).toHaveTextContent("₹1,340.00");
    expect(screen.getByText("Total with GST").nextSibling).toHaveTextContent("₹43,680");

    await userEvent.click(screen.getAllByRole("button", { name: /create po/i })[0]);
    await waitFor(() => expect(createPo).toHaveBeenCalledTimes(1));
    expect(createPo.mock.calls[0][0].items).toEqual([
      expect.objectContaining({ rawMaterial: "m1", hsn: "5402", gstPercent: 5 }),
      expect.objectContaining({ rawMaterial: "m2", hsn: "", gstPercent: 12 }),
    ]);
  });

  it("a rate or HSN typed over is what is shown and sent", async () => {
    openForm();
    const gst = screen.getAllByLabelText("GST %") as HTMLInputElement[];
    await waitFor(() => expect(gst[1].value).toBe("12"));
    await userEvent.clear(gst[1]);
    await userEvent.type(gst[1], "5");
    await userEvent.type(screen.getAllByLabelText("HSN")[1], "4007");
    // Both lines at 5% now: the rate goes in the labels.
    expect(await screen.findByText("CGST @ 2.5%")).toBeInTheDocument();
    expect(screen.getByText("Total with GST").nextSibling).toHaveTextContent("₹43,050");
    await userEvent.click(screen.getAllByRole("button", { name: /create po/i })[0]);
    await waitFor(() => expect(createPo).toHaveBeenCalledTimes(1));
    expect(createPo.mock.calls[0][0].items[1]).toEqual(expect.objectContaining({ hsn: "4007", gstPercent: 5 }));
  });

  it("will not send an HSN that is not 4 to 8 digits", async () => {
    openForm();
    await userEvent.type(screen.getAllByLabelText("HSN")[1], "12");
    await userEvent.click(screen.getAllByRole("button", { name: /create po/i })[0]);
    expect(await screen.findByText("4–8 digits")).toBeInTheDocument();
    expect(createPo).not.toHaveBeenCalled();
  });
});

describe("the arithmetic, as the server does it", () => {
  const settings = purchaseTaxSettings({ gstin: "33AABFB1234C1Z5", invoice: { defaultGstPercent: 12, stateCode: "" } as never });

  it("reads our state off the GSTIN, and the default off Settings", () => {
    expect(settings).toEqual({ ourState: "33", defaultGst: 12 });
    expect(purchaseTaxSettings(undefined)).toEqual({ ourState: "", defaultGst: 5 });
  });

  it("a line's rate: its own (0 included), else its material's, else the default", () => {
    expect(lineGst({ gstPercent: 18 }, { gstPercent: 5 }, 12)).toBe(18);
    expect(lineGst({ gstPercent: 0 }, { gstPercent: 5 }, 12)).toBe(0);
    expect(lineGst({ gstPercent: "" }, { gstPercent: 5 }, 12)).toBe(5);
    expect(lineGst({ gstPercent: null }, { gstPercent: null }, 12)).toBe(12);
  });

  it("IGST from another state; nothing from a composition dealer", () => {
    const lines = [{ quantity: 10, rate: 150.5, gstPercent: 18 }];
    expect(pricePoLines(lines, { supplierGstin: "27AAACK1234M1Z9", ourState: "33", noGst: false }).totals)
      .toEqual({ taxable: 1505, cgst: 0, sgst: 0, igst: 270.9, tax: 270.9, roundOff: 0.1, grand: 1776 });
    expect(pricePoLines(lines, { supplierGstin: "33AAACK1234M1Z2", ourState: "33", noGst: false }).totals)
      .toMatchObject({ cgst: 135.45, sgst: 135.45, igst: 0 });
    const reason = noGstReason({ name: "Small Mill", gstRegistration: "composition" });
    expect(reason).toMatch(/composition dealer/);
    expect(pricePoLines(lines, { ourState: "33", noGst: !!reason }).totals).toMatchObject({ tax: 0, grand: 1505 });
  });
});

describe("the printed purchase order", () => {
  const po: PurchaseOrder = {
    _id: "p1", poNo: 1042, status: "Open", createdAt: "2026-11-20T00:00:00Z",
    supplier: { _id: "s1", name: "Surat Filaments", gstin: "24AAACK1234M1Z9" },
    items: [
      { rawMaterial: { _id: "m1", name: "Nylon 70D", unit: "kg" }, quantity: 800, price: 105.5, hsn: "5402", gstPercent: 5 },
      { rawMaterial: { _id: "m2", name: "Rubber thread", unit: "kg" }, quantity: 120, price: 212.75, hsn: "4007", gstPercent: 18 },
    ],
    tax: { supplyType: "inter", noGst: "", totals: { taxable: 109930, cgst: 0, sgst: 0, igst: 8815.4, tax: 8815.4, roundOff: -0.4, grand: 118745 } },
  };

  it("shows each line's HSN and rate, and the IGST under the taxable value", () => {
    render(<PoDocument po={po} />);
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("5402")).toBeInTheDocument();
    expect(within(rows[1]).getByText("5%")).toBeInTheDocument();
    expect(within(rows[2]).getByText("18%")).toBeInTheDocument();
    expect(screen.getByText("IGST").nextSibling).toHaveTextContent("₹8,815.40");
    expect(screen.getByText("Round off").nextSibling).toHaveTextContent("₹-0.40");
    expect(screen.getByText("Total with GST").nextSibling).toHaveTextContent("₹1,18,745");
    expect(screen.getByText(/One Lakh Eighteen Thousand Seven Hundred Forty Five Rupees only/)).toBeInTheDocument();
  });
});
