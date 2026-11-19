import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// "Raise PO" per supplier tops each low material up to twice its minimum.
// It did not look at open purchase orders, so the same shortfall was
// offered again every time the page was opened. The server now takes
// what is on order off the suggestion and says how much that was; this
// is the page saying it, and ordering the reduced figure.

const get = vi.fn();
const createPo = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } };
});
vi.mock("@/features/suppliers/api", () => ({ poService: { create: (...a: unknown[]) => createPo(...a) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { ReorderSuggestions } from "./StockOps";

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ReorderSuggestions />
      </MemoryRouter>
    </QueryClientProvider>
  );

const group = (items: unknown[]) => ({
  success: true,
  count: items.length,
  suppliers: [{ supplierId: "s1", supplierName: "Kumar Yarns", estimatedValue: 15000, items }],
});

describe("reorder suggestions", () => {
  beforeEach(() => {
    get.mockReset();
    createPo.mockReset();
    createPo.mockResolvedValue({ _id: "po1", poNo: 1042 });
  });

  it("says what is already on order, and orders only the rest", async () => {
    get.mockResolvedValue(group([
      { materialId: "m1", name: "Nylon 70D", stock: 20, minStock: 50, price: 300, suggestedQty: 50, onOrder: 30 },
    ]));
    renderPanel();
    expect(await screen.findByText(/Nylon 70D \(\+50, 30 already on order\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /raise po/i }));
    expect(createPo).toHaveBeenCalledWith({ supplier: "s1", items: [{ rawMaterial: "m1", quantity: 50, price: 300 }] });
  });

  it("says nothing of orders when there are none", async () => {
    get.mockResolvedValue(group([
      { materialId: "m1", name: "Nylon 70D", stock: 20, minStock: 50, price: 300, suggestedQty: 80, onOrder: 0 },
    ]));
    renderPanel();
    expect(await screen.findByText(/Nylon 70D \(\+80\)/)).toBeInTheDocument();
    expect(screen.queryByText(/already on order/)).not.toBeInTheDocument();
  });
});
