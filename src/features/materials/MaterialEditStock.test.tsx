import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MaterialDetailPage } from "./MaterialDetailPage";
import { materialService } from "./api";
import { RawMaterial } from "./types";

// ══════════════════════════════════════════════════════════════════
//  EDITING A MATERIAL DOES NOT TOUCH ITS STOCK
//
//  The edit form had a Stock field, and sent it with every save — the
//  figure it loaded. Typing there changed the stock with no ledger row,
//  no reason and no name. Worse, changing only the minimum on a form
//  opened before an order was approved wrote the old figure back, and
//  the yarn the approval had drawn was in the books again.
//
//  Stock is changed with Adjust stock (or a receipt, or an issue), each
//  of which records itself. The form shows the figure and sends none.
// ══════════════════════════════════════════════════════════════════

const updateMutate = vi.fn();
const put = vi.fn();
const post = vi.fn();

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return {
    ...actual,
    httpClient: { put: (...a: unknown[]) => put(...a), post: (...a: unknown[]) => post(...a), get: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  };
});
vi.mock("./hooks", () => ({
  useMaterialLedger: () => ({ data: undefined, isLoading: false, error: null, refetch: () => {} }),
  useMaterial: () => ({ data: material, isLoading: false, isError: false }),
  useYarnLots: () => ({ data: [], isLoading: false }),
  useMaterialMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    update: { mutate: updateMutate, isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
    setArchived: { mutate: vi.fn(), isPending: false },
    adjustStock: { mutate: vi.fn(), isPending: false },
  }),
  useLotMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    setStatus: { mutate: vi.fn(), isPending: false },
    adjust: { mutate: vi.fn(), isPending: false },
  }),
  useLot: () => ({ data: undefined, isLoading: false }),
  useSupplierOptions: () => ({ data: [{ _id: "s1", name: "Kumar Yarns" }], isLoading: false }),
  useMaterialCategories: () => ({ data: { categories: ["warp", "weft", "rubber", "covering", "Chemicals"] }, isLoading: false }),
}));
vi.mock("../materialGroups/hooks", () => ({
  useMaterialGroups: () => ({ data: [{ _id: "g1", name: "Nylon yarns" }], isLoading: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const material = {
  _id: "m1", __v: 4, name: "Nylon 70D Navy", category: "warp", group: { _id: "g1", name: "Nylon yarns" },
  unit: "kg", supplier: { _id: "s1", name: "Kumar Yarns" }, price: 310, avgCost: 300, unitCost: 300,
  stockValue: 37500, stock: 125, minStock: 40, stockMovements: [], inwards: [], outwards: [], lots: [],
} as unknown as RawMaterial;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/materials/m1"]}>
      <Routes><Route path="/materials/:id" element={<MaterialDetailPage />} /></Routes>
    </MemoryRouter>
  );

beforeEach(() => { updateMutate.mockReset(); put.mockReset(); post.mockReset(); });

describe("the edit form", () => {
  it("shows the stock, and does not take a new one", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: /Edit/ }));

    const stock = screen.getByLabelText("Stock");
    expect(stock).toHaveValue("125 kg");
    // Before: an ordinary number field, saved as typed.
    expect(stock).toBeDisabled();
    expect(screen.getByText(/Changed with Adjust stock/)).toBeInTheDocument();
  });

  it("saves the rest and sends no stock figure", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: /Edit/ }));

    const min = screen.getByLabelText("Min stock");
    await u.clear(min);
    await u.type(min, "60");
    await u.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const sent = updateMutate.mock.calls[0][0];
    expect(sent).toMatchObject({ id: "m1", body: { name: "Nylon 70D Navy", minStock: 60, price: 310 } });
    // Before: stock: 125 — whatever had been drawn since the form opened, put back.
    expect(sent.body).not.toHaveProperty("stock");
  });
});

describe("adding a material", () => {
  it("still takes an opening stock", async () => {
    post.mockResolvedValue({ success: true, material: { _id: "m2" } });
    await materialService.create({ name: "Polyester 150D", category: "weft", supplier: "s1", stock: 50, minStock: 10, price: 180 });
    expect(post).toHaveBeenCalledWith("/materials/create-raw-material", expect.objectContaining({ name: "Polyester 150D", stock: 50 }));
  });
});

describe("the edit request", () => {
  it("never carries a stock figure, whatever it is handed", async () => {
    put.mockResolvedValue({ success: true, material });
    await materialService.update("m1", { name: "Nylon 70D Navy", category: "warp", minStock: 60, stock: 125 }, 4);

    expect(put).toHaveBeenCalledTimes(1);
    const [url, body] = put.mock.calls[0];
    expect(url).toBe("/materials/edit-raw-material");
    expect(body).toMatchObject({ _id: "m1", name: "Nylon 70D Navy", minStock: 60, expectedVersion: 4 });
    expect(body).not.toHaveProperty("stock");
  });
});
