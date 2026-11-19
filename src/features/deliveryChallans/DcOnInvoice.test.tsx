import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ══════════════════════════════════════════════════════════════════
//  A CHALLAN THAT IS ON AN INVOICE
//
//  An invoice bills the customer for what its challans carried, and
//  nothing on an issued invoice is edited. The server now holds the
//  challan to the same: while the invoice stands it cannot be cancelled
//  and its goods cannot change (prod: tests/api/dcStockRules.test.js).
//
//  These hold the page to what the server will do, so nothing is offered
//  and then refused:
//
//    • the page says which invoice the challan is on, and links to it
//    • "Cancel DC…" is not offered while it is on one
//    • the edit form fixes the goods and leaves open what bills nothing:
//      boxes and the despatch detail
//
//  And one thing found on the same page: recording an e-way bill
//  refreshed a list nothing reads, so the page went on saying "E-way
//  bill needed" until it was reloaded.
//
//  Only the HTTP transport is mocked: the real api, hooks and page run.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const patch = vi.fn();

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return {
    ...actual,
    httpClient: {
      get: (...a: unknown[]) => get(...a),
      post: (...a: unknown[]) => post(...a),
      put: (...a: unknown[]) => put(...a),
      patch: (...a: unknown[]) => patch(...a),
      delete: vi.fn(),
      getBlob: vi.fn(),
    },
  };
});

const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

import { DcDetailPage } from "./DcDetailPage";
import { DcEditModal } from "./DcEditModal";
import type { DeliveryChallan } from "./types";

const INVOICE = { _id: "inv1", invoiceNumber: "INV/2026-27/0007" };

const challan = (over: Partial<DeliveryChallan> = {}): DeliveryChallan => ({
  _id: "dc1", __v: 3, dcNumber: "E-26-27-0007", type: "elastic", status: "dispatched",
  customerName: "Sunrise Garments", vehicleNo: "", totalQuantity: 600, totalAmount: 7200, totalBoxes: 6,
  items: [{ elastic: { _id: "e1", name: "20mm Woven" }, elasticName: "20mm Woven", unit: "m", quantity: 600, rate: 12, boxes: 6 }],
  ...over,
});

let current: DeliveryChallan;

const withClient = (ui: React.ReactNode, path = "/delivery-challans/dc1") => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

const showPage = (over: Partial<DeliveryChallan> = {}) => {
  current = challan(over);
  return withClient(
    <Routes>
      <Route path="/delivery-challans/:id" element={<DcDetailPage />} />
    </Routes>
  );
};

beforeEach(() => {
  [get, post, put, patch, toast].forEach((m) => m.mockReset());
  get.mockImplementation((url: string) => {
    if (String(url).includes("/dc/detail")) return Promise.resolve({ success: true, dc: current });
    return Promise.resolve({ success: true, elastics: [] });
  });
});

describe("the challan's page", () => {
  it("says which invoice it is on, and links to it", async () => {
    showPage({ invoice: INVOICE });
    const chip = await screen.findByText("On invoice INV/2026-27/0007");
    expect(chip.closest("a")).toHaveAttribute("href", "/invoices/inv1");
    // And what that means for it, in words.
    expect(screen.getByText(/cannot be\s+cancelled and its quantities cannot be changed while that invoice stands/i)).toBeInTheDocument();
  });

  it("does not offer to cancel it, and still offers Edit", async () => {
    showPage({ invoice: INVOICE });
    await screen.findByText("On invoice INV/2026-27/0007");
    expect(screen.queryByRole("button", { name: /cancel dc/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("offers Cancel on a despatched challan that is on no invoice", async () => {
    showPage({ invoice: null });
    expect(await screen.findByRole("button", { name: /cancel dc/i })).toBeInTheDocument();
    expect(screen.queryByText(/on invoice/i)).not.toBeInTheDocument();
  });

  it("reads the challan again once an e-way bill is recorded", async () => {
    const user = userEvent.setup();
    showPage({ totalAmount: 80000 });
    expect(await screen.findByText(/e-way bill needed/i)).toBeInTheDocument();

    post.mockImplementation((url: string) => {
      expect(url).toBe("/dc/dc1/ewaybill/paste");
      current = challan({ totalAmount: 80000, ewaybill: { status: "generated", number: "123456789012" } });
      return Promise.resolve({ success: true, dc: current });
    });
    await user.click(screen.getByRole("button", { name: /e-way bill/i }));
    await user.type(screen.getByPlaceholderText(/12 digits/i), "123456789012");
    await user.type(screen.getByLabelText(/vehicle number/i), "TN39BX1234");
    await user.click(screen.getByRole("button", { name: /record e-way bill/i }));

    // Before: the page kept "E-way bill needed" and the button, because
    // the list it refreshed was one nothing reads.
    expect(await screen.findByText("E-way bill 123456789012")).toBeInTheDocument();
    expect(screen.queryByText(/e-way bill needed/i)).not.toBeInTheDocument();
  });
});

describe("its edit form", () => {
  const openForm = (over: Partial<DeliveryChallan> = {}) =>
    withClient(<DcEditModal dc={challan(over)} open onClose={() => {}} />);

  it("fixes the goods while the invoice stands", () => {
    openForm({ invoice: INVOICE });
    expect(screen.getByTestId("dc-on-invoice-note")).toHaveTextContent("INV/2026-27/0007");
    expect(screen.getByLabelText(/^quantity$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^rate in rupees/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /add item/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remove line/i })).toBeDisabled();
    // What bills nothing stays open.
    expect(screen.getByLabelText(/^boxes$/i)).toBeEnabled();
    expect(screen.getByLabelText(/vehicle no/i)).toBeEnabled();
    expect(screen.getByLabelText(/^remarks$/i)).toBeEnabled();
  });

  it("still sends a recount of its boxes", async () => {
    const user = userEvent.setup();
    put.mockResolvedValue({ success: true, dc: challan({ invoice: INVOICE }) });
    openForm({ invoice: INVOICE });
    const boxes = screen.getByLabelText(/^boxes$/i);
    await user.clear(boxes);
    await user.type(boxes, "7");
    await user.type(screen.getByLabelText(/reason for this change/i), "Recounted at the gate");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [url, body] = put.mock.calls[0];
    expect(url).toBe("/dc/update");
    expect(body.items).toEqual([expect.objectContaining({ elastic: "e1", quantity: 600, rate: 12, boxes: 7 })]);
  });

  it("is the ordinary form, goods and all, for a challan on no invoice", () => {
    openForm({ invoice: null });
    expect(screen.queryByTestId("dc-on-invoice-note")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^quantity$/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /add item/i })).toBeEnabled();
  });
});
