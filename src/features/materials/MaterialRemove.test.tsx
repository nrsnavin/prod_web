import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MaterialDetailPage } from "./MaterialDetailPage";
import { RawMaterial } from "./types";

// ══════════════════════════════════════════════════════════════════
//  REMOVING A MASTER RECORD
//
//  The server decides what "remove" can mean: a material nothing has
//  used is deleted, and one named by an order, a PO, a goods receipt
//  or an elastic's recipe is archived instead — deleting it would
//  leave all of those pointing at nothing.
//
//  So the screen must not assume. Reporting "deleted" and navigating
//  away from a material that is still there sends somebody hunting for
//  a row that was merely hidden, and the toast is the only place they
//  would have learned otherwise.
// ══════════════════════════════════════════════════════════════════

const removeMutate = vi.fn();
const archiveMutate = vi.fn();
const toast = vi.fn();
const navigate = vi.fn();

let material: RawMaterial;

vi.mock("./hooks", () => ({
  useMaterial: () => ({ data: material, isLoading: false, isError: false }),
  useYarnLots: () => ({ data: [], isLoading: false }),
  useMaterialMutations: () => ({
    update:      { mutate: vi.fn(), isPending: false },
    remove:      { mutate: removeMutate, isPending: false },
    setArchived: { mutate: archiveMutate, isPending: false },
    adjustStock: { mutate: vi.fn(), isPending: false },
  }),
  useLotMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    setStatus: { mutate: vi.fn(), isPending: false },
    adjust: { mutate: vi.fn(), isPending: false },
  }),
  useLot: () => ({ data: undefined, isLoading: false }),
  useSupplierOptions: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const base = (over: Partial<RawMaterial> = {}): RawMaterial => ({
  _id: "m1",
  name: "Nylon 70D",
  category: "warp",
  price: 300,
  avgCost: 330,
  unitCost: 330,
  stockValue: 33000,
  stock: 100,
  minStock: 20,
  stockMovements: [],
  inwards: [],
  outwards: [],
  lots: [],
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/materials/m1"]}>
      <Routes>
        <Route path="/materials/:id" element={<MaterialDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

const openRemoveDialog = () =>
  userEvent.click(screen.getByRole("button", { name: /Remove material/i }));

/** Open the confirm dialog and press its confirm button. */
const pressRemove = async () => {
  await openRemoveDialog();
  await userEvent.click(screen.getByRole("button", { name: /^Remove$/ }));
};

beforeEach(() => {
  removeMutate.mockReset();
  archiveMutate.mockReset();
  toast.mockReset();
  navigate.mockReset();
  material = base();
});

describe("removing a material", () => {
  it("warns that a used material is archived, not deleted", async () => {
    renderPage();
    await openRemoveDialog();

    expect(screen.getByText(/archived instead/i)).toBeInTheDocument();
    expect(screen.getByText(/history intact/i)).toBeInTheDocument();
    // The old copy promised something the server no longer does.
    expect(screen.queryByText(/permanently deleted/i)).not.toBeInTheDocument();
  });

  it("leaves the page when the material really was deleted", async () => {
    removeMutate.mockImplementation((_id, opts) =>
      opts?.onSuccess?.({
        success: true, deleted: true, archived: false,
        message: '"Nylon 70D" deleted — nothing had used it.',
      })
    );
    renderPage();
    await pressRemove();

    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/nothing had used it/), "success"
    );
    expect(navigate).toHaveBeenCalledWith("/materials");
  });

  it("stays put, and says why, when it was archived instead", async () => {
    // The bug this guards: navigating away would suggest the record is
    // gone. It is not — it is still here, archived, and the person
    // needs to see that.
    removeMutate.mockImplementation((_id, opts) =>
      opts?.onSuccess?.({
        success: true, deleted: false, archived: true,
        usage: [{ label: "goods receipt", count: 3 }],
        message: '"Nylon 70D" is used by 3 goods receipts, so it was archived instead of deleted.',
      })
    );
    renderPage();
    await pressRemove();

    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/3 goods receipts.*archived instead/), "success"
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("archiving a material deliberately", () => {
  it("offers Archive on an active material", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Archive/i }));

    expect(archiveMutate).toHaveBeenCalledWith(
      { id: "m1", archived: true },
      expect.anything()
    );
  });

  it("offers Restore on an archived one", async () => {
    material = base({ archived: true });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Restore/i }));

    expect(archiveMutate).toHaveBeenCalledWith(
      { id: "m1", archived: false },
      expect.anything()
    );
  });

  it("says on the page that an archived material is hidden", async () => {
    // Otherwise its absence from every picker is a mystery.
    material = base({ archived: true });
    renderPage();
    expect(screen.getByText(/hidden from the pickers/i)).toBeInTheDocument();
  });
});
