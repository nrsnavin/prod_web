import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MovementLot, movementColumns } from "./MaterialDetailPage";
import type { StockMovement } from "./types";

// ═══════════════════════════════════════════════════════════════════
//  The ledger's Dye lot column.
//
//  Three kinds of answer reach this cell and they are not equal:
//  a lot RECORDED on the receipt or adjustment that caused the move,
//  a lot a warping batch drew (exact), and a lot INFERRED for an order
//  approval that never named one.
//
//  The whole point of the column is that the third looks different.
//  A row presenting a reading as a record is worse than a blank one,
//  because somebody will warp off it. So most of what is asserted here
//  is that the marking survives.
//
//  Cell and column list are tested separately, as with the Reason
//  column: the cell alone would pass with the column never mounted.
// ═══════════════════════════════════════════════════════════════════

const movement = (over: Partial<StockMovement> = {}): StockMovement => ({
  date: "2026-06-10T00:00:00.000Z",
  type: "PO_INWARD",
  typeLabel: "Goods received",
  quantity: 40,
  balance: 140,
  ...over,
});

const renderCell = (m: StockMovement) =>
  render(
    <MemoryRouter>
      <MovementLot movement={m} />
    </MemoryRouter>
  );

const renderColumn = (key: string, m: StockMovement) => {
  const col = movementColumns.find((c) => c.key === key)!;
  return render(<MemoryRouter>{col.render(m)}</MemoryRouter>);
};

describe("the Dye lot cell", () => {
  it("shows a recorded lot plainly", () => {
    renderCell(movement({ lotNo: "D-2002", lotDerived: false }));
    expect(screen.getByText("D-2002")).toBeInTheDocument();
    expect(screen.queryByText(/inferred/i)).not.toBeInTheDocument();
  });

  it("marks an inferred lot as inferred", () => {
    renderCell(movement({ type: "ORDER_APPROVAL", lotNo: "D-1001", lotDerived: true }));
    expect(screen.getByText("D-1001")).toBeInTheDocument();
    expect(screen.getByText(/inferred/i)).toBeInTheDocument();
  });

  it("says why an inferred lot is inferred, not just that it is", () => {
    const { container } = renderCell(
      movement({ type: "ORDER_APPROVAL", lotNo: "D-1001", lotDerived: true })
    );
    const titled = container.querySelector("[title]");
    expect(titled?.getAttribute("title")).toMatch(/oldest lot|not recorded/i);
  });

  it("shows a dash when no lot could be established", () => {
    renderCell(movement({ type: "ORDER_APPROVAL", lotNo: "" }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows a dash when the field is absent altogether", () => {
    // An older server that does not send the field at all must not
    // render "undefined" into the column.
    renderCell(movement());
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("a warping batch row", () => {
  const batch = movement({
    type: "BATCH_ISSUE",
    typeLabel: "Drawn for warping",
    quantity: 0,
    lotQuantity: -40,
    lotOnly: true,
    lotNo: "D-4471",
    balance: 70,
  });

  it("reports the kilos off the rack, not the zero that stock moved", () => {
    // Read off textContent rather than getByText: the sign, the figure
    // and the caption are separate nodes inside one cell, so a
    // whole-string query would only ever match by accident.
    const { container } = renderColumn("qty", batch);
    expect(container.textContent).toContain("40");
    expect(container.textContent).not.toMatch(/(^|\D)0(\D|$)/);
    expect(screen.getByText(/from the rack/i)).toBeInTheDocument();
  });

  it("leaves the balance column blank rather than repeating an unchanged figure", () => {
    // The balance did not move — printing 70 here would read as though
    // this row had held it there.
    renderColumn("balance", batch);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("70")).not.toBeInTheDocument();
  });

  it("shows its lot as recorded, because a batch draws named lots", () => {
    renderCell(batch);
    expect(screen.getByText("D-4471")).toBeInTheDocument();
    expect(screen.queryByText(/inferred/i)).not.toBeInTheDocument();
  });

  it("still prints an ordinary row's balance", () => {
    // The guard above must key off lotOnly and nothing else — a normal
    // movement that happens to carry a lot keeps its balance.
    renderColumn("balance", movement({ lotNo: "D-2002", balance: 140 }));
    expect(screen.getByText("140")).toBeInTheDocument();
  });
});

describe("the column is actually mounted", () => {
  it("has a Dye lot column in the ledger", () => {
    const col = movementColumns.find((c) => c.key === "lot");
    expect(col).toBeDefined();
    expect(col!.header).toBe("Dye lot");
  });

  it("renders the lot through that column, not only through the cell", () => {
    renderColumn("lot", movement({ lotNo: "D-2002" }));
    expect(screen.getByText("D-2002")).toBeInTheDocument();
  });

  it("keeps the lot beside the quantity rather than at the end of the row", () => {
    // Where it sits is part of whether it gets read: a lot four columns
    // right of the figure it belongs to is a lot nobody looks at.
    const keys = movementColumns.map((c) => c.key);
    expect(keys.indexOf("lot")).toBeGreaterThan(keys.indexOf("qty"));
    expect(keys.indexOf("lot")).toBeLessThan(keys.indexOf("balance"));
  });
});
