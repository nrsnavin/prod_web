import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrderMaterialPo } from "./OrderMaterialPo";
import { OrderMrp, OrderMrpMaterial, OrderPurchaseOrder } from "./types";

// ══════════════════════════════════════════════════════════════════
//  YARN THIS ORDER HAS ALREADY TAKEN, AND YARN IT HAS ALREADY BOUGHT
//
//  Approving an order draws its material out of stock immediately, so
//  the stock figure beside the requirement no longer contains it. The
//  panel was comparing the two anyway, and reported an order as short
//  of the very yarn it was standing on — with a button offering to buy
//  it a second time.
//
//  The same shape one step later: once a purchase order is raised the
//  shortfall does not move until the goods arrive, so the button was
//  live for the whole of that window and every press bought again.
// ══════════════════════════════════════════════════════════════════

const raiseMutate = vi.fn();
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
  requiredWeight: 100,
  allocated: 0,
  outstanding: 100,
  inStock: 0,
  onOrder: 0,
  shortfall: 100,
  toBuy: 100,
  unitPrice: 320,
  stockKnown: true,
  supplierId: "s1",
  supplierName: "Kumar Yarns",
  ...over,
});

const setMrp = (materials: OrderMrpMaterial[], status = "Open") => {
  mrp = { orderId: "o1", orderNo: 1042, status, materials } as OrderMrp;
};

const renderPanel = () =>
  render(
    <MemoryRouter>
      <OrderMaterialPo orderId="o1" />
    </MemoryRouter>
  );

const raiseButton = () => screen.queryByRole("button", { name: /raise po for shortfall/i });

beforeEach(() => {
  raiseMutate.mockClear();
  toast.mockClear();
  raised = [];
});

describe("material already drawn for this order", () => {
  it("is not counted as a shortfall", () => {
    // Approval took all 100 kg. Stock reads 0 because of that, not in
    // spite of it — there is nothing to buy.
    setMrp([
      material({ allocated: 100, outstanding: 0, inStock: 0, shortfall: 0, toBuy: 0 }),
    ]);
    renderPanel();

    expect(raiseButton()).not.toBeInTheDocument();
  });

  it("is shown, so the zero stock figure explains itself", () => {
    setMrp([
      material({ allocated: 100, outstanding: 0, inStock: 0, shortfall: 0, toBuy: 0 }),
    ]);
    renderPanel();

    expect(screen.getByRole("columnheader", { name: /^allocated$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^unallocated$/i })).toBeInTheDocument();
  });

  it("keeps the columns off an order that has not been approved", () => {
    // Nothing allocated on any row: a column of dashes is noise on the
    // screen that matters most.
    setMrp([material()]);
    renderPanel();

    expect(screen.queryByRole("columnheader", { name: /^allocated$/i })).not.toBeInTheDocument();
  });

  it("still reports what a part-drawn order is short of", () => {
    // Forced through on 40 of the 100 it needed: 60 is genuinely owed.
    setMrp([
      material({ allocated: 40, outstanding: 60, inStock: 0, shortfall: 60, toBuy: 60 }),
    ]);
    renderPanel();

    expect(raiseButton()).toBeInTheDocument();
  });
});

describe("once the order is approved", () => {
  // Approval allocates the stock to the order — takes it out of the
  // balance and holds it. From that point this panel reports; it does
  // not purchase.

  it("offers no purchase order at all", () => {
    setMrp(
      [material({ allocated: 40, outstanding: 60, inStock: 0, shortfall: 60, toBuy: 60 })],
      "Approved"
    );
    renderPanel();

    // Short on paper, and still no button: buying happens before approval.
    expect(raiseButton()).not.toBeInTheDocument();
  });

  it("says the stock has been allocated", () => {
    setMrp([material({ allocated: 100, outstanding: 0, shortfall: 0, toBuy: 0 })], "Approved");
    renderPanel();

    expect(screen.getByText(/stock allocated/i)).toBeInTheDocument();
    expect(screen.getByText(/allocated when it was approved/i)).toBeInTheDocument();
  });

  it("names the columns for what they hold, not for a movement", () => {
    setMrp([material({ allocated: 100, outstanding: 0, shortfall: 0, toBuy: 0 })], "Approved");
    renderPanel();

    expect(screen.getByRole("columnheader", { name: /^allocated$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^unallocated$/i })).toBeInTheDocument();
  });

  it("does not go quiet about what a forced approval left owing", () => {
    // The button is gone, so the news has to arrive some other way —
    // otherwise the gap is discovered when the machine stops.
    setMrp(
      [material({ allocated: 40, outstanding: 60, inStock: 0, shortfall: 60, toBuy: 60 })],
      "Approved"
    );
    renderPanel();

    expect(screen.getByText(/approved on part stock/i)).toBeInTheDocument();
    expect(screen.getByText(/not allocated to this order/i)).toBeInTheDocument();
    // And where to go instead of the button that is no longer there.
    expect(screen.getByText(/purchase-order screen/i)).toBeInTheDocument();
  });

  it("stays quiet when the whole requirement is allocated", () => {
    setMrp([material({ allocated: 100, outstanding: 0, shortfall: 0, toBuy: 0 })], "Approved");
    renderPanel();

    expect(screen.queryByText(/approved on part stock/i)).not.toBeInTheDocument();
  });

  it("keeps buying open while the order is still Open", () => {
    // The rule must not close the door it exists to keep open.
    setMrp([material()], "Open");
    renderPanel();

    expect(raiseButton()).toBeInTheDocument();
  });

  it("treats a missing status as not approved", () => {
    // Guessing "approved" would quietly remove the only way to buy for
    // an order that may not be approved at all. Guessing the other way
    // costs one server round trip that answers plainly.
    mrp = { orderId: "o1", orderNo: 1042, materials: [material()] } as OrderMrp;
    renderPanel();

    expect(raiseButton()).toBeInTheDocument();
  });
});

describe("a shortfall that is already on order", () => {
  it("offers no second purchase order", () => {
    setMrp([material({ onOrder: 100, toBuy: 0 })]);
    renderPanel();

    expect(raiseButton()).not.toBeInTheDocument();
    expect(screen.getByText(/awaiting delivery/i)).toBeInTheDocument();
  });

  it("offers only the part not yet bought", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    setMrp([material({ onOrder: 40, toBuy: 60 })]);
    renderPanel();

    await user.click(raiseButton()!);
    // 60, not the 100 still showing in the Shortfall column.
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("says the gap is bought rather than that nothing is short", () => {
    // "Nothing is short" would be a lie the buyer could act on; the
    // material IS short, it is simply already paid for.
    setMrp([material({ onOrder: 100, toBuy: 0 })]);
    renderPanel();

    expect(screen.getByText(/nothing further to order/i)).toBeInTheDocument();
  });
});
