import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MaterialDetailPage, movementColumns } from "./MaterialDetailPage";
import { RawMaterial, StockMovement, YarnLot } from "./types";

const adjustMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()
);
const toast = vi.fn();

let lots: YarnLot[] = [];

const material: RawMaterial = {
  _id: "m1",
  name: "Nylon 70D",
  category: "warp",
  price: 320,
  stock: 100,
  minStock: 20,
  stockMovements: [],
  lots: [],
};

vi.mock("./hooks", () => ({
  useMaterial: () => ({ data: material, isLoading: false, isError: false }),
  useMaterialMutations: () => ({
    update: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
    adjustStock: { mutate: adjustMutate, isPending: false },
  }),
  useYarnLots: () => ({ data: lots, isLoading: false }),
  useLotMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    setStatus: { mutate: vi.fn(), isPending: false },
  }),
  useLotTrace: () => ({ data: undefined, isLoading: false }),
  useSupplierOptions: () => ({ data: [] }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const lot = (over: Partial<YarnLot> = {}): YarnLot => ({
  _id: "lot1",
  rawMaterial: "m1",
  lotNo: "D-4471",
  shade: "Off White",
  receivedQty: 100,
  consumedQty: 20,
  balance: 80,
  status: "open",
  ...over,
});

const openAdjust = async () => {
  render(
    <MemoryRouter initialEntries={["/materials/m1"]}>
      <Routes>
        <Route path="/materials/:id" element={<MaterialDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
  await userEvent.click(screen.getByRole("button", { name: /adjust stock/i }));
};

// The page action and the form submit share the label "Adjust stock",
// and neither carries an explicit type — a bare <button> defaults to
// submit either way — so scope to the form rather than filtering on it.
const submitButton = () => {
  const form = document.querySelector("form")!;
  return within(form).getByRole("button", { name: /^adjust stock$/i });
};

const typeAdjustment = async (v: string) => {
  const field = screen.getByLabelText(/Adjustment/i);
  await userEvent.clear(field);
  await userEvent.type(field, v);
};

describe("naming the dye lot on a stock adjustment", () => {
  beforeEach(() => {
    adjustMutate.mockClear();
    toast.mockClear();
    lots = [lot()];
  });

  it("asks for nothing until a direction is chosen", async () => {
    await openAdjust();
    expect(screen.queryByLabelText(/^Lot no$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Dye lot$/i)).not.toBeInTheDocument();
  });

  it("asks for a lot number when stock is being added", async () => {
    await openAdjust();
    await typeAdjustment("40");

    expect(screen.getByLabelText(/^Lot no$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Shade$/i)).toBeInTheDocument();
    // Adding stock cannot draw from an existing lot, so no picker.
    expect(screen.queryByLabelText(/^Dye lot$/i)).not.toBeInTheDocument();
  });

  it("offers a lot to draw from when stock is being removed", async () => {
    await openAdjust();
    await typeAdjustment("-30");

    expect(screen.getByLabelText(/^Dye lot$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Lot no$/i)).not.toBeInTheDocument();
  });

  it("sends the lot number when adding", async () => {
    await openAdjust();
    await typeAdjustment("40");
    await userEvent.type(screen.getByLabelText(/^Reason/i), "Found in the far rack");
    await userEvent.type(screen.getByLabelText(/^Lot no$/i), "D-6100");
    await userEvent.type(screen.getByLabelText(/^Shade$/i), "Ecru");
    await userEvent.click(submitButton());

    expect(adjustMutate).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 40, lotNo: "D-6100", shade: "Ecru" }),
      expect.anything()
    );
  });

  it("sends the chosen lot when removing", async () => {
    await openAdjust();
    await typeAdjustment("-30");
    await userEvent.type(screen.getByLabelText(/^Reason/i), "Damaged in the store");
    await userEvent.selectOptions(screen.getByLabelText(/^Dye lot$/i), "lot1");
    await userEvent.click(submitButton());

    expect(adjustMutate).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: -30, yarnLot: "lot1" }),
      expect.anything()
    );
  });

  it("still adjusts when no lot is given", async () => {
    // Untracked material has no lot, and stock nobody can place should
    // not be blocked on inventing one.
    await openAdjust();
    await typeAdjustment("40");
    await userEvent.type(screen.getByLabelText(/^Reason/i), "Opening balance");
    await userEvent.click(submitButton());

    expect(adjustMutate).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 40, lotNo: "" }),
      expect.anything()
    );
  });

  it("says so when there is no open lot to draw from", async () => {
    lots = [];
    await openAdjust();
    await typeAdjustment("-30");

    expect(screen.getByText(/No open lots for this material/i)).toBeInTheDocument();
  });

  it("shows each lot's remaining balance in the picker", async () => {
    await openAdjust();
    await typeAdjustment("-30");

    expect(
      screen.getByRole("option", { name: /D-4471 · Off White — 80 left/ })
    ).toBeInTheDocument();
  });
});

describe("the stock movements table", () => {
  it("renders a populated order reference instead of crashing on it", async () => {
    // The detail endpoint populates stockMovements.order, so it arrives as
    // an object. Dropped straight into JSX it took the whole page down with
    // React error #31 — "objects are not valid as a React child".
    material.stockMovements = [
      {
        date: "2026-07-01T00:00:00.000Z",
        type: "ORDER_APPROVAL",
        quantity: -40,
        balance: 60,
        order: { _id: "o1", orderNo: 1042 },
      },
    ];
    render(
      <MemoryRouter initialEntries={["/materials/m1"]}>
        <Routes>
          <Route path="/materials/:id" element={<MaterialDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Order #1042")).toBeInTheDocument();
    material.stockMovements = [];
  });

  it("still renders a plain id, for a payload that was never populated", () => {
    material.stockMovements = [
      { date: "2026-07-01T00:00:00.000Z", type: "ORDER_APPROVAL", quantity: -40, order: "raw-id" },
    ];
    render(
      <MemoryRouter initialEntries={["/materials/m1"]}>
        <Routes>
          <Route path="/materials/:id" element={<MaterialDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("raw-id")).toBeInTheDocument();
    material.stockMovements = [];
  });
});

describe("the ledger's quantity column", () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/materials/m1"]}>
        <Routes>
          <Route path="/materials/:id" element={<MaterialDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  const movement = (over: Partial<StockMovement> = {}): StockMovement => ({
    date: "2026-07-01T00:00:00.000Z",
    type: "STOCK_ADJUST",
    quantity: 0,
    ...over,
  });

  afterEach(() => {
    material.stockMovements = [];
  });

  it("shows a deduction in red, with a minus", () => {
    material.stockMovements = [movement({ type: "ORDER_APPROVAL", quantity: -40, balance: 60 })];
    renderPage();

    const cell = screen.getByText("−40");
    expect(cell).toHaveClass("text-status-danger");
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("shows an addition in green, with a plus", () => {
    material.stockMovements = [movement({ type: "PO_INWARD", quantity: 100, balance: 160 })];
    renderPage();

    const cell = screen.getByText("+100");
    expect(cell).toHaveClass("text-status-success");
  });

  // The page carries other zeros and dashes (min stock, empty panels), so
  // these assertions are scoped to the ledger row rather than the page.
  const ledgerRow = (type: string) => {
    const chip = screen.getByText(type.replace(/_/g, " "));
    return within(chip.closest("tr")!);
  };

  it("does not colour a zero movement as a gain", () => {
    material.stockMovements = [movement({ type: "STOCK_ADJUST", quantity: 0, balance: 60 })];
    renderPage();

    expect(ledgerRow("STOCK_ADJUST").getByText("0")).not.toHaveClass("text-status-success");
  });

  it("shows a dash when no balance was ever recorded", () => {
    material.stockMovements = [movement({ type: "PO_INWARD", quantity: 10 })];
    renderPage();

    // More than one cell on this row renders a dash — the Reason column
    // does too when nothing explains the movement — so the balance cell
    // cannot be found by its text. Found by the column's position in
    // `movementColumns` rather than a hard-coded index: this broke once
    // already when a column was inserted ahead of it, and the number in
    // the test said nothing about which column it meant.
    const balanceAt = movementColumns.findIndex((c) => c.key === "balance");
    const cells = screen.getByText("PO INWARD").closest("tr")!.querySelectorAll("td");
    expect(cells[balanceAt]).toHaveTextContent("—");
  });
});
