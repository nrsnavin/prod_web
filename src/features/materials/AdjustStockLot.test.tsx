import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MaterialDetailPage } from "./MaterialDetailPage";
import { ledgerColumns } from "./MaterialLedgerCard";
import { LedgerRow, RawMaterial, YarnLot } from "./types";

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
  useMaterialLedger: () => ({ data: undefined, isLoading: false, error: null, refetch: () => {} }),
  useMaterial: () => ({ data: material, isLoading: false, isError: false }),
  useMaterialMutations: () => ({
    update: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
    setArchived: { mutate: vi.fn(), isPending: false },
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

describe("the ledger's cells", () => {
  // Tested against `ledgerColumns` directly rather than through the page.
  // The page renders the ledger from its own query now, so reaching these
  // cells through MaterialDetailPage would mean mocking that query and
  // the test would be about the mock. What matters here is the cells.

  const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
    _id: "r1",
    date: "2026-07-01T00:00:00.000Z",
    type: "ORDER_APPROVAL",
    label: "Order approval",
    quantity: 40,
    direction: -1,
    signedQuantity: -40,
    balance: 60,
    reference: "",
    referenceId: null,
    referenceKind: null,
    lotNo: "",
    unitPrice: 0,
    remarks: "",
    ...over,
  });

  const cell = (key: string, r: LedgerRow) => {
    const col = ledgerColumns("kg").find((c) => c.key === key);
    expect(col).toBeDefined();
    return render(<MemoryRouter>{col!.render(r)}</MemoryRouter>);
  };

  it("puts a receipt in the In column and leaves Out empty", () => {
    const r = row({ direction: 1, label: "Goods receipt", quantity: 100, signedQuantity: 100 });
    cell("in", r);
    expect(screen.getByText("100")).toBeInTheDocument();
    cell("out", r);
    // Two dashes would now be on screen if Out had printed the quantity.
    expect(screen.queryAllByText("100")).toHaveLength(1);
  });

  it("puts an issue in the Out column and leaves In empty", () => {
    const r = row({ direction: -1, quantity: 40 });
    cell("out", r);
    expect(screen.getByText("40")).toBeInTheDocument();
    cell("in", r);
    expect(screen.queryAllByText("40")).toHaveLength(1);
  });

  it("shows the quantity unsigned, because the column already says which way", () => {
    // A minus inside the Out column would read as a negative issue.
    cell("out", row({ direction: -1, quantity: 40 }));
    expect(screen.queryByText("−40")).not.toBeInTheDocument();
    expect(screen.queryByText("-40")).not.toBeInTheDocument();
  });

  it("links an order reference", () => {
    cell("reference", row({ reference: "Order #1042", referenceKind: "order", referenceId: "o1" }));
    expect(screen.getByRole("link", { name: "Order #1042" })).toHaveAttribute(
      "href",
      "/orders/o1"
    );
  });

  it("links a purchase order reference", () => {
    cell(
      "reference",
      row({ reference: "PO-77", referenceKind: "purchaseOrder", referenceId: "p1" })
    );
    expect(screen.getByRole("link", { name: "PO-77" })).toHaveAttribute(
      "href",
      "/purchase-orders/p1"
    );
  });

  it("links a job reference", () => {
    cell("reference", row({ reference: "Job J-55", referenceKind: "job", referenceId: "j1" }));
    expect(screen.getByRole("link", { name: "Job J-55" })).toHaveAttribute("href", "/jobs/j1");
  });

  it("shows an unlinked reference as plain text rather than a dead link", () => {
    cell("reference", row({ reference: "Manual entry", referenceKind: null, referenceId: null }));
    expect(screen.getByText("Manual entry")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a dash when nothing identifies the movement", () => {
    cell("reference", row());
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("puts the dye lot in the details column", () => {
    cell("details", row({ lotNo: "D-4471" }));
    expect(screen.getByText(/Lot D-4471/)).toBeInTheDocument();
  });

  it("shows the running balance", () => {
    cell("balance", row({ balance: 1234.5 }));
    expect(screen.getByText("1,234.5")).toBeInTheDocument();
  });

  it("names the unit in the balance header, so the number is not bare", () => {
    const col = ledgerColumns("mtr").find((c) => c.key === "balance");
    expect(col!.header).toBe("Balance (mtr)");
  });
});
