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
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
