import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MaterialDetailPage } from "./MaterialDetailPage";
import { RawMaterial } from "./types";

// ══════════════════════════════════════════════════════════════════
//  CLONING A RAW MATERIAL
//
//  A new shade of a yarn already bought is the same material with a
//  different name: same category, group, supplier, unit, price and
//  reorder level. A clone copies that specification and nothing about
//  the position — never the stock, which belongs to the material that
//  received it, and never the name, which the person cloning gives.
// ══════════════════════════════════════════════════════════════════

const createMutate = vi.fn();
const toast = vi.fn();
const navigate = vi.fn();

vi.mock("./hooks", () => ({
  useMaterialLedger: () => ({ data: undefined, isLoading: false, error: null, refetch: () => {} }),
  useMaterial: () => ({ data: material, isLoading: false, isError: false }),
  useYarnLots: () => ({ data: [], isLoading: false }),
  useMaterialMutations: () => ({
    create: { mutate: createMutate, isPending: false },
    update: { mutate: vi.fn(), isPending: false },
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
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const material = {
  _id: "m1", name: "Nylon 70D Navy", category: "warp", group: { _id: "g1", name: "Nylon yarns" },
  unit: "kg", supplier: { _id: "s1", name: "Kumar Yarns" }, price: 310, avgCost: 300, unitCost: 300,
  stockValue: 37500, stock: 125, minStock: 40, stockMovements: [], inwards: [], outwards: [], lots: [],
} as unknown as RawMaterial;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/materials/m1"]}>
      <Routes><Route path="/materials/:id" element={<MaterialDetailPage />} /></Routes>
    </MemoryRouter>
  );

beforeEach(() => { createMutate.mockReset(); navigate.mockReset(); });

describe("cloning a raw material", () => {
  it("opens the add form with the specification, no name and no stock", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: /Clone/ }));

    expect(screen.getByText("Clone of Nylon 70D Navy")).toBeInTheDocument();
    expect(screen.getByLabelText(/Material name/)).toHaveValue("");
    expect(screen.getByLabelText(/Category/)).toHaveValue("warp");
    expect(screen.getByLabelText(/^Group/)).toHaveValue("g1");
    expect(screen.getByLabelText(/Supplier/)).toHaveValue("s1");
    expect(screen.getByLabelText(/Price/)).toHaveValue(310);
    expect(screen.getByLabelText(/Min stock/)).toHaveValue(40);
    expect(screen.getByLabelText(/Opening stock/)).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Add material" })).toBeInTheDocument();
  });

  it("creates a new material, never touching the one it came from", async () => {
    createMutate.mockImplementation((_v, opts) => opts.onSuccess({ _id: "m2" }));
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: /Clone/ }));
    await u.type(screen.getByLabelText(/Material name/), "Nylon 70D Black");
    await u.click(screen.getByRole("button", { name: "Add material" }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      name: "Nylon 70D Black", category: "warp", group: "g1", supplier: "s1", unit: "kg",
      price: 310, minStock: 40, stock: 0,
    });
    expect(navigate).toHaveBeenCalledWith("/materials/m2");
  });

  it("will not save a clone without a name", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: /Clone/ }));
    await u.click(screen.getByRole("button", { name: "Add material" }));
    expect(createMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });
});
