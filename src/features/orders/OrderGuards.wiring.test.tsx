import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ══════════════════════════════════════════════════════════════════
//  APPROVING, COMPLETING AND CANCELLING AN ORDER
//
//  Each one is a single press away on the order's page, and none can be
//  taken back. So each asks first, and the question carries the order's
//  own figures: what approval draws from stock, how much of the order is
//  still unmade or undelivered when it is closed. A dialog that only
//  repeats its button teaches people to click through it.
//
//  Cancelling an approved order hands its yarn back and pings the owner
//  on WhatsApp; the server reads a reason for both, so it is asked for.
//
//  Only the HTTP transport is mocked: the real api.ts, hooks.ts and the
//  page run, so the reason reaching the endpoint is checked for real.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
const post = vi.fn();

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return {
    ...actual,
    httpClient: {
      get: (...a: unknown[]) => get(...a),
      post: (...a: unknown[]) => post(...a),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      getBlob: vi.fn(),
    },
  };
});

const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));
vi.mock("@/features/orders/OrderAnalytics", () => ({ OrderAnalytics: () => null }));
vi.mock("@/features/orders/OrderDeliveryChallans", () => ({ OrderDeliveryChallans: () => null }));
vi.mock("@/features/orders/OrderSuggestedPlan", () => ({ OrderSuggestedPlan: () => null }));
vi.mock("@/features/orders/OrderYarnLots", () => ({ OrderYarnLots: () => null }));
vi.mock("@/features/orders/OrderMaterialPo", () => ({ OrderMaterialPo: () => null }));
vi.mock("@/components/print/PrintModal", () => ({ PrintModal: () => null }));

import { OrderDetailPage } from "./OrderDetailPage";

const order = (over = {}) => ({
  _id: "o1", orderNo: 4, status: "Open", __v: 1,
  po: "PO-9", date: "2026-01-01", supplyDate: "2026-02-01",
  customer: { _id: "c1", name: "Ravi Textiles" },
  elastics: [{
    id: "e1", name: "20mm Woven", ordered: 14000, produced: 3500, packed: 0,
    delivered: 0, undelivered: 14000, notAssigned: 0, pendingDelivery: 14000, pending: 0,
  }],
  jobs: [],
  rawMaterialRequired: [
    { id: "m1", name: "Nylon 70D", requiredWeight: 120, inStock: 400, stockSufficient: true },
    { id: "m2", name: "Rubber 42", requiredWeight: 80, inStock: 20, stockSufficient: false },
  ],
  excessPlanning: [], amendments: [], fingerprints: [],
  ...over,
});

const show = (over = {}) => {
  get.mockImplementation((url: string) =>
    String(url).includes("/order/get-orderDetail")
      ? Promise.resolve({ success: true, data: order(over) })
      : Promise.resolve({ success: true, data: [], elastics: [] })
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/orders/o1"]}>
        <Routes><Route path="/orders/:id" element={<OrderDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({ success: true });
  toast.mockReset();
});

describe("approving", () => {
  it("one press asks, naming what comes out of stock and what is short", async () => {
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Approve…" }));
    expect(post).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("2 materials, 200 kg in all, come out of stock.");
    expect(dialog).toHaveTextContent(/1 is short/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
    expect(post).not.toHaveBeenCalled();
  });

  it("approves from the dialog's named button", async () => {
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Approve…" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve order #4" }));
    expect(post.mock.calls[0][0]).toMatch(/\/order\/approve/);
  });
});

describe("completing", () => {
  it("says how much is unmade and undelivered before closing the order", async () => {
    show({ status: "InProgress" });
    await userEvent.click(await screen.findByRole("button", { name: "Complete…" }));
    expect(post).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("10,500 m of 14,000 m have not been produced.");
    expect(dialog).toHaveTextContent("Nothing has been delivered yet.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Complete order #4" }));
    expect(post).toHaveBeenCalledWith("/order/complete", { orderId: "o1" });
  });
});

describe("cancelling", () => {
  it("an Open order: asks, then cancels with no reason needed", async () => {
    show();
    // Rarer acts sit under More; the header leads with the next step.
    await userEvent.click(await screen.findByRole("button", { name: /more/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel order…" }));
    expect(post).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel order #4" }));
    expect(post).toHaveBeenCalledWith("/order/cancel", { orderId: "o1" });
  });

  it("an approved order: asks why, and the reason reaches the server", async () => {
    show({ status: "Approved" });
    // Rarer acts sit under More; the header leads with the next step.
    await userEvent.click(await screen.findByRole("button", { name: /more/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel order…" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/goes back to stock/);
    // Not without a reason.
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel order #4" }));
    expect(post).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByRole("textbox"), "Customer withdrew the PO");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel order #4" }));
    expect(post).toHaveBeenCalledWith("/order/cancel", { orderId: "o1", cancelReason: "Customer withdrew the PO" });
  });
});
