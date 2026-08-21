import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { materialColumns } from "./MrpPage";
import type { MrpData } from "./types";

// ═══════════════════════════════════════════════════════════════════
//  Dye lots on the MRP sheet.
//
//  Two facts share one column and they are not interchangeable:
//
//    PROGRAMMED  This job's warping plan has already chosen the lot a
//                beam section will run off. The decision is made, and
//                it was made because two lots meeting inside one beam
//                show as a shade band in the finished elastic.
//
//    AVAILABLE   Yarn that is merely open on the rack.
//
//  Printing them alike would put an operator on the wrong bag, so
//  nearly everything asserted here is about the two staying apart.
// ═══════════════════════════════════════════════════════════════════

type MrpMaterial = MrpData["materials"][number];
type MrpLot = NonNullable<MrpMaterial["lots"]>[number];

const lot = (over: Partial<MrpLot> = {}): MrpLot => ({
  yarnLot: "L1",
  lotNo: "D-1001",
  shade: "",
  balance: 120,
  ageDays: 30,
  committed: false,
  ...over,
});

const material = (over: Partial<MrpMaterial> = {}): MrpMaterial => ({
  rawMaterial: "M1",
  name: "Nylon 40D",
  category: "warp",
  requiredWeight: 100,
  inStock: 200,
  ...over,
});

const renderLots = (m: MrpMaterial) => {
  const col = materialColumns.find((c) => c.key === "lots")!;
  return render(<MemoryRouter>{col.render(m)}</MemoryRouter>);
};

describe("the MRP dye lot column", () => {
  it("is actually mounted on the sheet", () => {
    const col = materialColumns.find((c) => c.key === "lots");
    expect(col).toBeDefined();
    expect(col!.header).toBe("Dye lot");
  });

  it("marks a lot the warping programme has chosen", () => {
    renderLots(material({ lots: [lot({ lotNo: "D-4471", committed: true })] }));
    expect(screen.getByText("D-4471")).toBeInTheDocument();
    expect(screen.getByText(/programmed/i)).toBeInTheDocument();
  });

  it("does not call an available lot programmed", () => {
    renderLots(material({ lots: [lot({ lotNo: "D-1001", committed: false })] }));
    expect(screen.queryByText(/programmed/i)).not.toBeInTheDocument();
  });

  it("puts the programmed lot ahead of the available ones", () => {
    const { container } = renderLots(
      material({
        lots: [
          lot({ yarnLot: "L1", lotNo: "D-1001", committed: false }),
          lot({ yarnLot: "L2", lotNo: "D-4471", committed: true }),
        ],
      })
    );
    const text = container.textContent ?? "";
    expect(text.indexOf("D-4471")).toBeLessThan(text.indexOf("D-1001"));
  });

  it("says when a programmed lot is no longer on the rack", () => {
    // The plan names a bag the rack may not still hold. That absence is
    // the single most actionable thing this column can report.
    renderLots(
      material({ lots: [lot({ lotNo: "D-4471", committed: true, balance: null })] })
    );
    expect(screen.getByText(/not on the rack/i)).toBeInTheDocument();
  });

  it("does not say that about a programmed lot that is still open", () => {
    renderLots(
      material({ lots: [lot({ lotNo: "D-4471", committed: true, balance: 80 })] })
    );
    expect(screen.queryByText(/not on the rack/i)).not.toBeInTheDocument();
  });

  it("caps a long list rather than filling the row", () => {
    const many = ["D-1", "D-2", "D-3", "D-4", "D-5"].map((lotNo, i) =>
      lot({ yarnLot: `L${i}`, lotNo, committed: false })
    );
    const { container } = renderLots(material({ lots: many }));
    expect(container.textContent).toContain("+2");
    expect(container.textContent).not.toContain("D-5");
  });

  it("shows a dash for a material with no lots", () => {
    renderLots(material({ lots: [] }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows a dash when the server did not send the field", () => {
    // An older backend omits `lots` entirely. The column must not
    // render "undefined" into the sheet.
    renderLots(material());
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
