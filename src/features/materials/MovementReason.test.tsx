import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MovementReason, movementColumns } from "./MaterialDetailPage";
import type { StockMovement } from "./types";

// ═══════════════════════════════════════════════════════════════════
//  The ledger's Reason column.
//
//  A row reading "-40" with nothing beside it is checkable but not
//  explainable, and "why did this material drop by 40 in March" is the
//  question a ledger exists to answer.
//
//  The cell is tested directly and the column list is asserted
//  separately: testing the cell alone would pass with the column never
//  mounted, and rendering the whole page would mean mocking every
//  unrelated field on it until the test was about the mock.
// ═══════════════════════════════════════════════════════════════════

const movement = (over: Partial<StockMovement> = {}): StockMovement => ({
  date: "2026-06-10T00:00:00.000Z",
  type: "PO_INWARD",
  typeLabel: "Goods received",
  quantity: 40,
  balance: 140,
  reference: "PO #55",
  referenceKind: "purchaseOrder",
  referenceId: "po1",
  ...over,
});


const renderCell = (m: StockMovement) =>
  render(
    <MemoryRouter>
      <MovementReason movement={m} />
    </MemoryRouter>
  );

/** What the Type column renders, so the enum-vs-words check is real. */
const renderType = (m: StockMovement) => {
  const col = movementColumns.find((c) => c.key === "type")!;
  return render(<MemoryRouter>{col.render(m)}</MemoryRouter>);
};

describe("why a stock movement happened", () => {
  it("names the purchase order behind a goods receipt", () => {
    renderCell(movement());

    const link = screen.getByRole("link", { name: "PO #55" });
    expect(link).toHaveAttribute("href", "/purchase-orders/po1");
  });

  it("names the order behind an approval", () => {
    renderCell(
      movement({
        type: "ORDER_APPROVAL",
        typeLabel: "Order approved",
        quantity: -40,
        reference: "Order #1042",
        referenceKind: "order",
        referenceId: "o1",
      })
    );

    expect(screen.getByRole("link", { name: "Order #1042" })).toHaveAttribute(
      "href",
      "/orders/o1"
    );
  });

  it("says what happened in words rather than as an enum", () => {
    renderType(movement());

    expect(screen.getByText("Goods received")).toBeInTheDocument();
    expect(screen.queryByText("PO_INWARD")).not.toBeInTheDocument();
  });

  it("falls back to the raw type if the server sent no label", () => {
    // An older server, or a movement type nobody has named yet. Showing
    // the enum beats showing a blank.
    renderType(movement({ typeLabel: undefined, type: "SOMETHING_NEW" }));
    expect(screen.getByText("SOMETHING NEW")).toBeInTheDocument();
  });

  it("shows the typed reason when there is no document", () => {
    // A manual adjustment has nothing behind it — the reason IS the
    // explanation.
    renderCell(
      movement({
        type: "STOCK_ADJUST",
        typeLabel: "Manual adjustment",
        quantity: -12,
        reference: null,
        referenceKind: null,
        referenceId: null,
        reason: "annual stock count correction",
      })
    );
    expect(screen.getByText("annual stock count correction")).toBeInTheDocument();
  });

  it("marks a reference that was matched rather than recorded", () => {
    // Receipts predating the PO field are reconstructed from the inward
    // history. A reconstruction and a record are not the same claim.
    renderCell(movement({ referenceDerived: true }));
    expect(screen.getByText("matched")).toBeInTheDocument();
  });

  it("does not mark a reference that was recorded at the time", () => {
    renderCell(movement({ referenceDerived: false }));
    expect(screen.queryByText("matched")).not.toBeInTheDocument();
  });

  it("dashes a row nothing explains rather than leaving it blank", () => {
    const { container } = renderCell(
      movement({ reference: null, referenceKind: null, referenceId: null, reason: "" })
    );
    expect(container).toHaveTextContent("—");
  });

  it("does not link a reference with no id behind it", () => {
    // The document is gone; the snapshotted number still reads, but
    // there is nothing to open.
    renderCell(movement({ referenceId: null, referenceKind: null, reference: "PO #55" }));

    expect(screen.getByText("PO #55")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "PO #55" })).not.toBeInTheDocument();
  });

  it("has a Reason column mounted on the ledger table", () => {
    // The cell can be perfect and invisible if the column was never
    // added. This is the assertion that catches that.
    expect(movementColumns.map((c) => c.key)).toContain("why");
    expect(movementColumns.find((c) => c.key === "why")!.header).toBe("Reason");
  });
});
