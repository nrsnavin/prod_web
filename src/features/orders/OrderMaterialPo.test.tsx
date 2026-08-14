import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OrderMaterialPo } from "./OrderMaterialPo";
import { OrderMrp, OrderMrpMaterial, OrderPurchaseOrder } from "./types";

// Raising a purchase order no longer happens here. A PO is an outward
// commitment, so the button now takes the buyer to the PO form with the
// lines filled in — they see the document before it exists, and can
// change a price or a quantity on the way. What this file checks is
// that the right data makes the trip.
const navigate = vi.fn();
const toast = vi.fn();

let mrp: OrderMrp | undefined;
let raised: OrderPurchaseOrder[] = [];

vi.mock("./hooks", () => ({
  useOrderMrp: () => ({ data: mrp, isLoading: false }),
  useOrderPurchaseOrders: () => ({ data: raised }),
}));
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => navigate,
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
  navigate.mockClear();
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
    // Scoped to the last cell: "on order" also dashes when there is
    // none, and an unscoped query cannot tell the two apart.
    const covered = screen.getByText("Spandex 40D").closest("tr")!;
    const cells = within(covered).getAllByRole("cell");
    expect(cells[cells.length - 1]).toHaveTextContent("—");
  });

  it("takes the buyer to the PO form with the shortfall filled in", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
    await user.click(screen.getByRole("button", { name: /draft purchase order/i }));

    expect(navigate).toHaveBeenCalledTimes(1);
    const [path, opts] = navigate.mock.calls[0] as [string, { state: { prefill: Record<string, unknown> } }];
    expect(path).toBe("/purchase-orders/new");
    expect(opts.state.prefill).toMatchObject({
      supplier: "s1",
      items: [{ rawMaterial: "m1", quantity: 70, price: 320 }],
    });
  });

  it("does not create anything on the way", async () => {
    // The whole point: nothing exists until the buyer confirms it on
    // the form. A toast saying "raised" here would be a lie.
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
    await user.click(screen.getByRole("button", { name: /draft purchase order/i }));

    expect(toast).not.toHaveBeenCalled();
  });

  it("carries the order, so the purchase stays answerable", async () => {
    // "Why did we buy this?" has to have an answer months later. Going
    // through a generic create form is exactly how that link gets lost.
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
    await user.click(screen.getByRole("button", { name: /draft purchase order/i }));

    const [, opts] = navigate.mock.calls[0] as [string, { state: { prefill: { forOrder: string } } }];
    expect(opts.state.prefill.forOrder).toBe("o1");
  });

  it("offers one draft per supplier, rather than raising several at once", async () => {
    // One purchase order goes to one supplier. A single button spanning
    // two would silently produce two documents from one click.
    const user = userEvent.setup();
    setMrp([
      material(),
      material({ rawMaterial: "m2", name: "Spandex 40D", supplierId: "s2", supplierName: "Sri Textiles" }),
    ]);
    renderPanel();

    await user.click(screen.getByRole("button", { name: /raise po for shortfall/i }));
    expect(screen.getByRole("button", { name: /draft for kumar yarns/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /draft for sri textiles/i })).toBeInTheDocument();
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

    // Its supplier had nothing else on the list, so its draft button
    // goes with it.
    expect(screen.queryByRole("button", { name: /draft for sri textiles/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /draft purchase order/i }));
    const [, opts] = navigate.mock.calls[0] as [string, { state: { prefill: { items: Array<{ rawMaterial: string }> } } }];
    expect(opts.state.prefill.items.map((i) => i.rawMaterial)).toEqual(["m1"]);
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
