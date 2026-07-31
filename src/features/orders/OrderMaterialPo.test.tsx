import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OrderMaterialPo } from "./OrderMaterialPo";
import { OrderMrp, OrderMrpMaterial, OrderPurchaseOrder } from "./types";

const raiseMutate = vi.fn(
  (
    _a: unknown,
    opts?: { onSuccess?: (r: { purchaseOrders: unknown[]; skipped: unknown[] }) => void }
  ) => opts?.onSuccess?.({ purchaseOrders: [{}], skipped: [] })
);
const toast = vi.fn();

let mrp: OrderMrp | undefined;
let raised: OrderPurchaseOrder[] = [];

vi.mock("./hooks", () => ({
  useOrderMrp: () => ({ data: mrp, isLoading: false }),
  useOrderPurchaseOrders: () => ({ data: raised }),
  useOrderRaisePo: () => ({ mutate: raiseMutate, isPending: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const material = (over: Partial<OrderMrpMaterial> = {}): OrderMrpMaterial => ({
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

const setMrp = (materials: OrderMrpMaterial[]) => {
  mrp = { orderId: "o1", orderNo: 1042, materials } as OrderMrp;
};

const renderPanel = () =>
  render(
    <MemoryRouter>
      <OrderMaterialPo orderId="o1" />
    </MemoryRouter>
  );

beforeEach(() => {
  raiseMutate.mockClear();
  toast.mockClear();
  raised = [];
  setMrp([material()]);
});

describe("OrderMaterialPo", () => {
  it("lists every material with its shortfall, not only the short ones", () => {
    setMrp([material(), material({ rawMaterial: "m2", name: "Spandex 40D", inStock: 500, shortfall: 0 })]);
    renderPanel();

    expect(screen.getByText("Nylon 70D")).toBeInTheDocument();
    expect(screen.getByText("Spandex 40D")).toBeInTheDocument();
    // The covered material shows a dash rather than a zero shortfall.
    const covered = screen.getByText("Spandex 40D").closest("tr")!;
    expect(within(covered).getByText("—")).toBeInTheDocument();
  });

  it("raises a PO for the shortfall of the whole order", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
    await user.click(screen.getByRole("button", { name: /^raise po$/i }));

    expect(raiseMutate).toHaveBeenCalledTimes(1);
    expect(raiseMutate.mock.calls[0][0]).toMatchObject({ materials: ["m1"] });
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/1 purchase order raised/i), "success");
  });

  it("never offers a material whose stock could not be read", () => {
    // Its "shortfall" is arithmetic on a placeholder, so buying on it
    // would be guessing with money.
    setMrp([material({ stockKnown: false })]);
    renderPanel();
    expect(screen.queryByRole("button", { name: /raise po for shortfall/i })).not.toBeInTheDocument();
  });

  it("explains a material that cannot be ordered for want of a supplier", () => {
    setMrp([material({ supplierId: undefined, supplierName: undefined })]);
    renderPanel();

    expect(screen.getByText(/cannot be ordered until a supplier is set/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /raise po for shortfall/i })).toBeDisabled();
  });

  it("excludes a material the user unticks", async () => {
    const user = userEvent.setup();
    setMrp([material(), material({ rawMaterial: "m2", name: "Spandex 40D", supplierId: "s2", supplierName: "Sri Textiles" })]);
    renderPanel();

    await user.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
    await user.click(screen.getByRole("checkbox", { name: /order spandex 40d/i }));
    await user.click(screen.getByRole("button", { name: /^raise po$/i }));

    expect(raiseMutate.mock.calls[0][0]).toMatchObject({ materials: ["m1"] });
  });

  it("reports what the server refused to order", async () => {
    const user = userEvent.setup();
    raiseMutate.mockImplementationOnce((_a, opts) =>
      opts?.onSuccess?.({
        purchaseOrders: [{}],
        skipped: [{ rawMaterial: "m9", name: "Rubber 22", reason: "no supplier set" }],
      })
    );
    renderPanel();

    await user.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
    await user.click(screen.getByRole("button", { name: /^raise po$/i }));

    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/not ordered:.*rubber 22.*no supplier set/i),
      "error"
    );
  });

  it("credits a PO raised through one of the order's jobs to that job", () => {
    raised = [
      {
        _id: "po1",
        poNo: 55,
        status: "Open",
        supplier: { _id: "s1", name: "Kumar Yarns" },
        items: [{ rawMaterial: "m1", quantity: 70, price: 320 }],
        forJob: { _id: "j1", jobOrderNo: 12 },
      } as unknown as OrderPurchaseOrder,
    ];
    renderPanel();

    expect(screen.getByRole("link", { name: /PO #55/ })).toBeInTheDocument();
    expect(screen.getByText(/via J-12/)).toBeInTheDocument();
  });
});
