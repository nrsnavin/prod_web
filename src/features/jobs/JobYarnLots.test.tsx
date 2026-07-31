import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { JobYarnLots } from "./JobYarnLots";
import { JobYarnLots as JobYarnLotsData } from "./types";

let data: JobYarnLotsData | undefined;
let isLoading = false;

vi.mock("./hooks", () => ({
  useJobYarnLots: () => ({ data, isLoading }),
}));

const use = (over: Partial<JobYarnLotsData["byElastic"][0]["lots"][0]> = {}) => ({
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
    data = {
      jobId: "j1",
      jobOrderNo: 812,
      hasUnattributed: false,
      lots: [{ yarnLot: "lot1", lotNo: "D-4471", shade: "Off White", materialName: "Nylon 70D" }],
      byElastic: [{ elasticId: "e1", elasticName: "25mm Woven", lots: [use()] }],
    };
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
    data = {
      jobId: "j1",
      jobOrderNo: 812,
      hasUnattributed: true,
      lots: [{ yarnLot: "lot1", lotNo: "D-4471", shade: "", materialName: "Nylon 70D" }],
      byElastic: [
        { elasticId: "e1", elasticName: "25mm Woven", lots: [] },
        { elasticId: null, elasticName: "Not attributed to an elastic", lots: [use()] },
      ],
    };
    renderPanel();

    expect(screen.getByText("not pinned to an elastic")).toBeInTheDocument();
    expect(screen.getByText("Nothing recorded for this elastic.")).toBeInTheDocument();
  });

  it("says a quantity is shared rather than dividing it", () => {
    data = {
      jobId: "j1",
      jobOrderNo: 812,
      hasUnattributed: false,
      lots: [{ yarnLot: "lot1", lotNo: "D-4471", shade: "", materialName: "Nylon 70D" }],
      byElastic: [
        { elasticId: "e1", elasticName: "25mm", lots: [use({ sharedAcross: 2 })] },
        { elasticId: "e2", elasticName: "32mm", lots: [use({ sharedAcross: 2 })] },
      ],
    };
    renderPanel();

    expect(screen.getAllByText(/shared across 2 elastics/)).toHaveLength(2);
    expect(screen.getAllByText("40 kg")).toHaveLength(2);
  });

  it("says when a batch has not been issued yet", () => {
    data = {
      jobId: "j1",
      jobOrderNo: 812,
      hasUnattributed: false,
      lots: [{ yarnLot: "lot1", lotNo: "D-4471", shade: "", materialName: "Nylon 70D" }],
      byElastic: [
        {
          elasticId: "e1",
          elasticName: "25mm",
          lots: [use({ batchStatus: "planned", issuedDate: null })],
        },
      ],
    };
    renderPanel();
    expect(screen.getByText(/not yet issued/)).toBeInTheDocument();
  });

  it("explains an empty panel rather than showing nothing", () => {
    data = {
      jobId: "j1",
      jobOrderNo: 812,
      hasUnattributed: false,
      lots: [],
      byElastic: [{ elasticId: "e1", elasticName: "25mm Woven", lots: [] }],
    };
    renderPanel();
    expect(screen.getByText("No lots recorded")).toBeInTheDocument();
  });

  it("tells the reader that cancelled batches are left out", () => {
    data = {
      jobId: "j1",
      jobOrderNo: 812,
      hasUnattributed: false,
      lots: [],
      byElastic: [],
    };
    renderPanel();
    expect(screen.getByText(/Cancelled batches are excluded/)).toBeInTheDocument();
  });
});
