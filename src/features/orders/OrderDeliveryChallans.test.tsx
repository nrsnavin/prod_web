import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrderDeliveryChallans } from "./OrderDeliveryChallans";
import type { OrderDeliveryChallans as Data } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE DELIVERY NOTES RAISED FOR AN ORDER
//
//  The page could say what was ordered, planned, produced and packed,
//  and then stopped. Whether any of it had been DESPATCHED — and on
//  which note — meant leaving the order and searching the DC list by
//  order number. That is the question customers ring up about.
//
//  What this pins down: every note is shown; a cancelled one is shown
//  but counts for nothing; and the panel says how much is still owed
//  per product rather than leaving somebody to add up the notes.
// ══════════════════════════════════════════════════════════════════

let data: Data | undefined;
vi.mock("./hooks", () => ({
  useOrderDeliveryChallans: () => ({ data, isLoading: false }),
}));

const dc = (over: Partial<Data["dcs"][number]> = {}): Data["dcs"][number] => ({
  id: "dc1",
  dcNumber: "DC/25-26/001",
  date: "2026-08-01T00:00:00.000Z",
  dispatchDate: "2026-08-02T00:00:00.000Z",
  status: "dispatched",
  type: "elastic",
  customerName: "Acme",
  totalQuantity: 400,
  totalAmount: 4800,
  vehicleNo: "",
  transporter: "",
  lrNumber: "",
  items: [{ elasticId: "e1", elasticName: "20mm Woven", quantity: 400, unit: "m" }],
  ...over,
});

const make = (over: Partial<Data> = {}): Data => ({
  orderId: "o1",
  orderNo: 1042,
  dcs: [dc()],
  lines: [
    { elasticId: "e1", elasticName: "20mm Woven", ordered: 1000, dispatched: 400, pending: 600 },
  ],
  totals: { count: 1, cancelled: 0, quantity: 400, ordered: 1000, dispatched: 400 },
  ...over,
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <OrderDeliveryChallans orderId="o1" />
    </MemoryRouter>
  );

beforeEach(() => {
  data = make();
});

describe("the delivery challan panel", () => {
  it("lists each note, linked to it", async () => {
    renderPanel();
    const link = screen.getByRole("link", { name: "DC/25-26/001" });
    expect(link).toHaveAttribute("href", "/delivery-challans/dc1");
  });

  it("says how much has gone out against what was ordered", async () => {
    renderPanel();
    expect(screen.getByText(/400 of 1,000 despatched/)).toBeInTheDocument();
    expect(screen.getByText(/600 still to go/)).toBeInTheDocument();
  });

  it("states ordered, despatched and pending per product", async () => {
    renderPanel();
    // An order part-delivered on one product and untouched on another
    // reads as half-done either way in a single total.
    const row = screen.getByText("20mm Woven").closest("tr")!;
    expect(within(row).getByText("1,000")).toBeInTheDocument();
    expect(within(row).getByText("400")).toBeInTheDocument();
    expect(within(row).getByText("600")).toBeInTheDocument();
  });

  it("shows an over-despatch rather than hiding it", async () => {
    data = make({
      lines: [
        { elasticId: "e1", elasticName: "20mm Woven", ordered: 1000, dispatched: 1200, pending: -200 },
      ],
    });
    renderPanel();
    expect(screen.getByText(/\+200 over/)).toBeInTheDocument();
  });

  it("names the products on each note", async () => {
    renderPanel();
    expect(screen.getByText(/20mm Woven 400m/)).toBeInTheDocument();
  });

  it("shows the despatch trail when there is one", async () => {
    data = make({
      dcs: [dc({ vehicleNo: "TN-39-AB-1234", transporter: "VRL", lrNumber: "77" })],
    });
    renderPanel();
    expect(screen.getByText(/TN-39-AB-1234 · VRL · LR 77/)).toBeInTheDocument();
  });

  it("says nothing has gone out yet, without an empty table", async () => {
    data = make({
      dcs: [], lines: [],
      totals: { count: 0, cancelled: 0, quantity: 0, ordered: 0, dispatched: 0 },
    });
    renderPanel();

    expect(screen.getByText(/nothing despatched yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("a cancelled note", () => {
  it("is still listed — somebody raised it", async () => {
    data = make({
      dcs: [dc({ status: "cancelled" })],
      totals: { count: 1, cancelled: 1, quantity: 0, ordered: 1000, dispatched: 0 },
      lines: [
        { elasticId: "e1", elasticName: "20mm Woven", ordered: 1000, dispatched: 0, pending: 1000 },
      ],
    });
    renderPanel();

    expect(screen.getByRole("link", { name: "DC/25-26/001" })).toBeInTheDocument();
    expect(screen.getByText("cancelled")).toBeInTheDocument();
  });

  it("is counted apart from the rest, so the header is not misread", async () => {
    data = make({
      dcs: [dc(), dc({ id: "dc2", dcNumber: "DC/25-26/002", status: "cancelled" })],
      totals: { count: 2, cancelled: 1, quantity: 400, ordered: 1000, dispatched: 400 },
    });
    renderPanel();

    expect(screen.getByText("2 notes")).toBeInTheDocument();
    expect(screen.getByText("1 cancelled")).toBeInTheDocument();
    // The despatched figure excludes it.
    expect(screen.getByText(/400 of 1,000 despatched/)).toBeInTheDocument();
  });
});
