import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { JobYarnLots } from "./JobYarnLots";
import { JobYarnLots as JobYarnLotsData, JobLotUse } from "./types";

let data: JobYarnLotsData | undefined;
let isLoading = false;

vi.mock("./hooks", () => ({
  useJobYarnLots: () => ({ data, isLoading }),
}));

/** A lot drawn against a batch — yarn already off the rack. */
const use = (over: Partial<JobLotUse> = {}): JobLotUse => ({
  source: "issued",
  batchId: "b1",
  batchNo: "WB-0001",
  batchStatus: "issued" as const,
  beamNos: [1, 2],
  yarnLot: "lot1",
  lotNo: "D-4471",
  shade: "Off White",
  materialName: "Nylon 70D",
  quantity: 40,
  sharedAcross: 1,
  issuedDate: "2026-07-01T00:00:00.000Z",
  ...over,
});

/** A lot chosen while writing the programme — nothing has moved yet. */
const programmed = (over: Partial<JobLotUse> = {}): JobLotUse => ({
  source: "planned",
  planId: "p1",
  batchId: null,
  batchNo: null,
  batchStatus: null,
  beamNos: [1],
  yarnLot: "lot2",
  lotNo: "D-4472",
  shade: "Ecru",
  materialName: "Nylon 70D",
  quantity: null,
  sections: 3,
  sharedAcross: 1,
  issuedDate: null,
  ...over,
});

const shell = (over: Partial<JobYarnLotsData> = {}): JobYarnLotsData => ({
  jobId: "j1",
  jobOrderNo: 812,
  hasUnattributed: false,
  lots: [],
  byElastic: [],
  sections: { total: 0, withLot: 0, open: 0 },
  openBeamNos: [],
  ...over,
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <JobYarnLots jobId="j1" />
    </MemoryRouter>
  );

describe("JobYarnLots", () => {
  beforeEach(() => {
    isLoading = false;
    data = undefined;
  });

  it("names the lot, shade and yarn under its elastic", () => {
    data = shell({
      lots: [
        {
          yarnLot: "lot1",
          lotNo: "D-4471",
          shade: "Off White",
          materialName: "Nylon 70D",
          source: "issued",
        },
      ],
      byElastic: [{ elasticId: "e1", elasticName: "25mm Woven", lots: [use()] }],
    });
    renderPanel();

    expect(screen.getByText("25mm Woven")).toBeInTheDocument();
    expect(screen.getByText("D-4471")).toBeInTheDocument();
    expect(screen.getByText("Off White")).toBeInTheDocument();
    expect(screen.getByText("40 kg")).toBeInTheDocument();
    expect(screen.getByText(/WB-0001 · beam 1, 2/)).toBeInTheDocument();
  });

  it("flags a batch that was never pinned to an elastic", () => {
    // The gap must not read as "all elastics" — that would be a guess
    // dressed up as a fact.
    data = shell({
      hasUnattributed: true,
      lots: [
        { yarnLot: "lot1", lotNo: "D-4471", shade: "", materialName: "Nylon 70D", source: "issued" },
      ],
      byElastic: [
        { elasticId: "e1", elasticName: "25mm Woven", lots: [] },
        { elasticId: null, elasticName: "Not attributed to an elastic", lots: [use()] },
      ],
    });
    renderPanel();

    expect(screen.getByText("not pinned to an elastic")).toBeInTheDocument();
    expect(screen.getByText("Nothing recorded for this elastic.")).toBeInTheDocument();
  });

  it("says a quantity is shared rather than dividing it", () => {
    data = shell({
      lots: [
        { yarnLot: "lot1", lotNo: "D-4471", shade: "", materialName: "Nylon 70D", source: "issued" },
      ],
      byElastic: [
        { elasticId: "e1", elasticName: "25mm", lots: [use({ sharedAcross: 2 })] },
        { elasticId: "e2", elasticName: "32mm", lots: [use({ sharedAcross: 2 })] },
      ],
    });
    renderPanel();

    expect(screen.getAllByText(/shared across 2 elastics/)).toHaveLength(2);
    expect(screen.getAllByText("40 kg")).toHaveLength(2);
  });

  it("says when a batch has not been issued yet", () => {
    data = shell({
      lots: [
        { yarnLot: "lot1", lotNo: "D-4471", shade: "", materialName: "Nylon 70D", source: "issued" },
      ],
      byElastic: [
        {
          elasticId: "e1",
          elasticName: "25mm",
          lots: [use({ batchStatus: "planned", issuedDate: null })],
        },
      ],
    });
    renderPanel();
    expect(screen.getByText(/not yet issued/)).toBeInTheDocument();
  });

  it("explains an empty panel rather than showing nothing", () => {
    data = shell({ byElastic: [{ elasticId: "e1", elasticName: "25mm Woven", lots: [] }] });
    renderPanel();
    expect(screen.getByText("No lots recorded")).toBeInTheDocument();
  });

  it("tells the reader that cancelled batches are left out", () => {
    data = shell();
    renderPanel();
    expect(screen.getByText(/Cancelled batches are excluded/)).toBeInTheDocument();
  });
});

// ── What the warping programme chose ─────────────────────────────────────
// The reported fault: a lot picked while writing the programme showed up
// nowhere until a batch was issued days later.

describe("lots chosen in the warping programme", () => {
  beforeEach(() => {
    isLoading = false;
    data = undefined;
  });

  it("shows a programmed lot with no batch behind it", () => {
    data = shell({
      lots: [
        { yarnLot: "lot2", lotNo: "D-4472", shade: "Ecru", materialName: "Nylon 70D", source: "planned" },
      ],
      byElastic: [{ elasticId: "e1", elasticName: "25mm", lots: [programmed()] }],
      sections: { total: 3, withLot: 3, open: 0 },
    });
    renderPanel();

    expect(screen.getByText("D-4472")).toBeInTheDocument();
    expect(screen.getByText("programmed")).toBeInTheDocument();
    expect(screen.getByText(/Warping programme · 3 sections/)).toBeInTheDocument();
  });

  it("does not put a weight on a lot nobody has weighed", () => {
    // Programming names the lot; the kilograms only exist once a batch
    // draws it. A number here would be invented, and believed.
    data = shell({
      byElastic: [{ elasticId: "e1", elasticName: "25mm", lots: [programmed()] }],
      sections: { total: 3, withLot: 3, open: 0 },
    });
    renderPanel();

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });

  it("keeps a programmed lot and an issued one apart", () => {
    data = shell({
      byElastic: [{ elasticId: "e1", elasticName: "25mm", lots: [programmed(), use()] }],
      sections: { total: 4, withLot: 4, open: 0 },
    });
    renderPanel();

    expect(screen.getByText("programmed")).toBeInTheDocument();
    expect(screen.getByText("issued")).toBeInTheDocument();
  });

  it("counts the sections still waiting for a lot, and names the beams", () => {
    // Left open is a legitimate state, not a fault — but it is one
    // somebody has to be able to see before the beam is built.
    data = shell({
      byElastic: [{ elasticId: "e1", elasticName: "25mm", lots: [programmed()] }],
      sections: { total: 5, withLot: 3, open: 2 },
      openBeamNos: [2, 3],
    });
    renderPanel();

    expect(screen.getByText("2 sections open")).toBeInTheDocument();
    expect(screen.getByText(/beam 2, 3/)).toBeInTheDocument();
  });

  it("warns when a programmed lot has since been quarantined", () => {
    data = shell({
      byElastic: [
        { elasticId: "e1", elasticName: "25mm", lots: [programmed({ lotStatus: "quarantined" })] },
      ],
      sections: { total: 3, withLot: 3, open: 0 },
    });
    renderPanel();
    expect(screen.getByText("quarantined")).toBeInTheDocument();
  });
});
