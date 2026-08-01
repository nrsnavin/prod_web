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

// ── Tapes on the printed sheet ────────────────────────────────────────
// A plan that runs one build several times over has to print so the
// warper can see where each tape starts. Printed flat, the beams are
// numbered but nothing says which run they belong to.

const tapedPlan: WarpingPlan = {
  _id: "p2",
  noOfBeams: 4,
  beams: [
    {
      beamNo: 1, totalEnds: 120, tapeNo: 1, elastic: { _id: "e1", name: "20mm" },
      sections: [{ warpYarn: { _id: "y1", name: "Nylon 40D" }, ends: 120 }],
    },
    {
      beamNo: 2, totalEnds: 60, tapeNo: 1, elastic: { _id: "e2", name: "32mm" },
      sections: [{ warpYarn: { _id: "y2", name: "Poly 150D" }, ends: 60 }],
    },
    {
      beamNo: 3, totalEnds: 120, tapeNo: 2, elastic: { _id: "e1", name: "20mm" },
      sections: [{ warpYarn: { _id: "y1", name: "Nylon 40D" }, ends: 120 }],
    },
    {
      beamNo: 4, totalEnds: 60, tapeNo: 2, elastic: { _id: "e2", name: "32mm" },
      sections: [{ warpYarn: { _id: "y2", name: "Poly 150D" }, ends: 60 }],
    },
  ],
};

describe("a programme that runs several tapes", () => {
  it("heads each tape, with its beam count and ends", () => {
    render(<WarpingProgrammeSheet open warping={warping} plan={tapedPlan} onClose={() => {}} />);
    expect(screen.getByText(/Tape 1/)).toBeInTheDocument();
    expect(screen.getByText(/Tape 2/)).toBeInTheDocument();
    // Each tape totals its own beams, not the whole plan.
    expect(screen.getAllByText(/2 beams · 180 ends/)).toHaveLength(2);
  });

  it("says how many tapes in the header", () => {
    render(<WarpingProgrammeSheet open warping={warping} plan={tapedPlan} onClose={() => {}} />);
    expect(screen.getByText("Tapes")).toBeInTheDocument();
    expect(screen.getByText(/4 beam\(s\) over 2 tapes/)).toBeInTheDocument();
  });

  it("names the elastic each beam warps, so a mixed tape reads", () => {
    render(<WarpingProgrammeSheet open warping={warping} plan={tapedPlan} onClose={() => {}} />);
    expect(screen.getByText(/Beam 1 · 20mm/)).toBeInTheDocument();
    expect(screen.getByText(/Beam 2 · 32mm/)).toBeInTheDocument();
  });

  it("prints an untaped plan exactly as it did before", () => {
    render(<WarpingProgrammeSheet open warping={warping} plan={plan} onClose={() => {}} />);
    // No heading that says nothing, and no tapes field in the header.
    expect(screen.queryByText(/^Tape /)).not.toBeInTheDocument();
    expect(screen.queryByText("Tapes")).not.toBeInTheDocument();
    expect(screen.getByText("Nylon 40D")).toBeInTheDocument();
  });

  it("does not head a single tape as though there were a choice", () => {
    const oneTape: WarpingPlan = {
      ...tapedPlan,
      noOfBeams: 2,
      beams: tapedPlan.beams.slice(0, 2),
    };
    render(<WarpingProgrammeSheet open warping={warping} plan={oneTape} onClose={() => {}} />);
    // The heading still appears (the beams do carry a tape), but the
    // header does not claim a count worth reading.
    expect(screen.getByText(/Tape 1/)).toBeInTheDocument();
    expect(screen.queryByText("Tapes")).not.toBeInTheDocument();
  });
});
