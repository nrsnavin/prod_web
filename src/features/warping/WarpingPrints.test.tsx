import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WarpingProgrammeSheet } from "./WarpingPrints";
import { Warping, WarpingPlan } from "./types";

const warping: Warping = {
  _id: "w1",
  status: "in_progress",
  date: "2026-07-01T00:00:00.000Z",
  job: { _id: "j1", jobOrderNo: 12, customer: { name: "Acme" } },
  elasticOrdered: [{ elastic: { _id: "e1", name: "E-100" }, quantity: 500 }],
};

// A plan whose section carries the run length as `maxMeters` — the field
// the backend actually persists.
const plan: WarpingPlan = {
  _id: "p1",
  noOfBeams: 1,
  beams: [
    {
      beamNo: 1,
      totalEnds: 240,
      sections: [{ warpYarn: { _id: "y1", name: "Nylon 40D" }, ends: 240, maxMeters: 1800 }],
    },
  ],
};

describe("WarpingProgrammeSheet", () => {
  it("prints the section run length (regression: meters were blank)", () => {
    render(<WarpingProgrammeSheet open warping={warping} plan={plan} onClose={() => {}} />);
    expect(screen.getByText("Nylon 40D")).toBeInTheDocument();
    // The meters entered on the plan must appear in the Length column.
    expect(screen.getByText("1800")).toBeInTheDocument();
  });

  it("shows an em dash when a section has no run length", () => {
    const noMeters: WarpingPlan = {
      ...plan,
      beams: [
        { ...plan.beams[0], sections: [{ warpYarn: { _id: "y1", name: "Nylon 40D" }, ends: 240 }] },
      ],
    };
    render(<WarpingProgrammeSheet open warping={warping} plan={noMeters} onClose={() => {}} />);
    // Scoped to the Length cell: the Dye lot column also shows an em dash
    // when no lot is set, so a bare getByText would now match two nodes.
    expect(sectionCells()).toHaveLength(5);
    expect(sectionCells()[4]).toHaveTextContent("—");
  });
});

/** The section row's cells: no. | yarn | dye lot | ends | length. */
function sectionCells() {
  const row = screen.getByText("Nylon 40D").closest("tr")!;
  return Array.from(row.querySelectorAll("td"));
}

describe("WarpingProgrammeSheet — dye lot", () => {
  const withLot = (section: Partial<WarpingPlan["beams"][0]["sections"][0]>): WarpingPlan => ({
    ...plan,
    beams: [
      {
        ...plan.beams[0],
        sections: [
          { warpYarn: { _id: "y1", name: "Nylon 40D" }, ends: 240, maxMeters: 1800, ...section },
        ],
      },
    ],
  });

  it("prints the lot the section runs off", () => {
    // This is the instruction the warper acts on: pull this section off
    // this bag, not whatever is nearest.
    render(
      <WarpingProgrammeSheet
        open
        warping={warping}
        plan={withLot({ lotNo: "D-4471", shade: "Off White" })}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("D-4471 · Off White")).toBeInTheDocument();
  });

  it("prefers the stored snapshot over the live lot record", () => {
    // The sheet is the copy that goes to the machine and gets filed, so
    // it must keep saying what it said on the day.
    render(
      <WarpingProgrammeSheet
        open
        warping={warping}
        plan={withLot({
          lotNo: "D-4471",
          yarnLot: { _id: "l1", lotNo: "RENUMBERED-9", shade: "" },
        })}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("D-4471")).toBeInTheDocument();
    expect(screen.queryByText(/RENUMBERED-9/)).not.toBeInTheDocument();
  });

  it("falls back to the populated lot when there is no snapshot", () => {
    render(
      <WarpingProgrammeSheet
        open
        warping={warping}
        plan={withLot({ yarnLot: { _id: "l1", lotNo: "D-9000" } })}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("D-9000")).toBeInTheDocument();
  });

  it("shows an em dash in the lot cell when no lot is set", () => {
    render(<WarpingProgrammeSheet open warping={warping} plan={plan} onClose={() => {}} />);
    expect(sectionCells()[2]).toHaveTextContent("—");
  });
});
