import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MrpShortfallPo } from "./MrpShortfallPo";
import { JobPurchaseOrder, MrpData } from "./types";

type MrpMaterial = MrpData["materials"][number];

const raiseMutate = vi.fn(
  (
    _a: unknown,
    opts?: { onSuccess?: (r: { purchaseOrders: unknown[]; skipped: unknown[] }) => void }
  ) => opts?.onSuccess?.({ purchaseOrders: [{}], skipped: [] })
);
const toast = vi.fn();

let raised: JobPurchaseOrder[] = [];

vi.mock("./hooks", () => ({
  useRaisePo: () => ({ mutate: raiseMutate, isPending: false }),
  useJobPurchaseOrders: () => ({ data: raised }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const material = (over: Partial<MrpMaterial> = {}): MrpMaterial => ({
  rawMaterial: "m1",
  name: "Nylon 70D",
  category: "warp",
  requiredWeight: 100,
  inStock: 30,
  shortfall: 70,
  unitPrice: 320,
  stockKnown: true,
  supplierId: "s1",
  supplierName: "Kumar Yarns",
  ...over,
});

const renderPanel = (materials: MrpMaterial[]) =>
  render(
    <MemoryRouter>
      <MrpShortfallPo jobId="j1" materials={materials} />
    </MemoryRouter>
  );

const openDialog = async () => {
  await userEvent.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
};

describe("the shortfall panel", () => {
  beforeEach(() => {
    raiseMutate.mockClear();
    toast.mockClear();
    raised = [];
  });

  it("stays out of the way when nothing is short", () => {
    const { container } = renderPanel([material({ shortfall: 0, inStock: 500 })]);
    expect(container).toBeEmptyDOMElement();
  });

  it("names what is short and by how much", () => {
    renderPanel([material()]);
    expect(screen.getByText(/1 material short for this job/i)).toBeInTheDocument();
    expect(screen.getByText("Nylon 70D")).toBeInTheDocument();
    expect(screen.getByText("70 short")).toBeInTheDocument();
  });

  it("never offers to order a material that could not be resolved", () => {
    // Its stock figure is a placeholder, so the shortfall is not a
    // reading and buying against it would be guessing.
    const { container } = renderPanel([material({ stockKnown: false })]);
    expect(container).toBeEmptyDOMElement();
  });

  it("flags a short material with no supplier and refuses to order it", () => {
    renderPanel([material({ supplierId: null, supplierName: "" })]);
    expect(screen.getByText("no supplier set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /raise po for shortfall/i })).toBeDisabled();
    expect(screen.getByText(/cannot be ordered until a supplier is set/i)).toBeInTheDocument();
  });

  it("orders the ones that can be, and says which were left out", async () => {
    renderPanel([
      material(),
      material({ rawMaterial: "m2", name: "Rubber Tape", supplierId: null, supplierName: "" }),
    ]);
    expect(screen.getByRole("button", { name: /raise po for shortfall/i })).toBeEnabled();
    expect(screen.getByText(/Rubber Tape cannot be ordered/i)).toBeInTheDocument();
  });
});

describe("the raise dialog", () => {
  beforeEach(() => {
    raiseMutate.mockClear();
    toast.mockClear();
    raised = [];
  });

  it("previews one purchase order per supplier", async () => {
    renderPanel([
      material(),
      material({ rawMaterial: "m2", name: "Spandex 40D", supplierId: "s2", supplierName: "Raja Spandex" }),
    ]);
    await openDialog();

    expect(screen.getByText(/2 purchase orders will be created/i)).toBeInTheDocument();
    expect(screen.getByText(/Kumar Yarns — 1 line/)).toBeInTheDocument();
    expect(screen.getByText(/Raja Spandex — 1 line/)).toBeInTheDocument();
  });

  it("puts one supplier's materials on a single order", async () => {
    renderPanel([
      material(),
      material({ rawMaterial: "m2", name: "Polyester 150D" }),
    ]);
    await openDialog();

    expect(screen.getByText(/1 purchase order will be created/i)).toBeInTheDocument();
    expect(screen.getByText(/Kumar Yarns — 2 lines/)).toBeInTheDocument();
  });

  it("sends only the shortfall, not the whole requirement", async () => {
    renderPanel([material()]);
    await openDialog();
    await userEvent.click(screen.getByRole("button", { name: /^raise po$/i }));

    expect(raiseMutate).toHaveBeenCalledWith(
      expect.objectContaining({ materials: ["m1"] }),
      expect.anything()
    );
  });

  it("lets a material be left off the order", async () => {
    renderPanel([
      material(),
      material({ rawMaterial: "m2", name: "Polyester 150D" }),
    ]);
    await openDialog();
    await userEvent.click(screen.getByRole("checkbox", { name: /Order Polyester 150D/i }));
    await userEvent.click(screen.getByRole("button", { name: /^raise po$/i }));

    expect(raiseMutate).toHaveBeenCalledWith(
      expect.objectContaining({ materials: ["m1"] }),
      expect.anything()
    );
  });

  it("blocks the raise when everything has been unticked", async () => {
    renderPanel([material()]);
    await openDialog();
    await userEvent.click(screen.getByRole("checkbox", { name: /Order Nylon 70D/i }));

    expect(screen.getByRole("button", { name: /^raise po$/i })).toBeDisabled();
  });

  it("passes the expected date and notes through", async () => {
    renderPanel([material()]);
    await openDialog();
    await userEvent.type(screen.getByLabelText(/Expected delivery/i), "2026-09-15");
    await userEvent.type(screen.getByLabelText(/^Notes$/i), "Job is waiting");
    await userEvent.click(screen.getByRole("button", { name: /^raise po$/i }));

    expect(raiseMutate).toHaveBeenCalledWith(
      expect.objectContaining({ expectedDate: "2026-09-15", notes: "Job is waiting" }),
      expect.anything()
    );
  });

  it("says out loud what the server could not order", async () => {
    // The skipped part is the bit that still needs doing.
    raiseMutate.mockImplementationOnce((_a, opts) =>
      opts?.onSuccess?.({
        purchaseOrders: [{}],
        skipped: [{ name: "Rubber Tape", reason: "no supplier set" }],
      })
    );
    renderPanel([material()]);
    await openDialog();
    await userEvent.click(screen.getByRole("button", { name: /^raise po$/i }));

    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Rubber Tape (no supplier set)"),
      "error"
    );
  });
});

describe("what is already on order", () => {
  beforeEach(() => {
    raiseMutate.mockClear();
    raised = [];
  });

  it("lists the POs raised against this job", () => {
    raised = [
      {
        _id: "po1",
        poNo: 1042,
        status: "Open",
        supplier: { _id: "s1", name: "Kumar Yarns" },
        items: [{ quantity: 70 }],
      },
    ];
    renderPanel([material()]);

    expect(screen.getByText("On order for this job")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PO #1042/ })).toHaveAttribute(
      "href",
      "/purchase-orders/po1"
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("still shows what is on order once nothing is short", () => {
    // The shortfall is gone precisely because it was ordered — that is
    // worth seeing, not a reason to hide the panel.
    raised = [
      { _id: "po1", poNo: 1042, status: "Open", supplier: { _id: "s1", name: "Kumar Yarns" }, items: [] },
    ];
    renderPanel([material({ shortfall: 0, inStock: 500 })]);

    expect(screen.getByText("On order for this job")).toBeInTheDocument();
    expect(screen.queryByText(/short for this job/)).not.toBeInTheDocument();
  });
});
