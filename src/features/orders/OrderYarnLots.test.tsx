import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrderYarnLots } from "./OrderYarnLots";
import type { OrderYarnLots as Data, OrderLotJob, OrderLotRow } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A shade complaint arrives quoting an order number. This panel is
//  what answers it — so the two things it must never do are report a
//  programmed lot as issued, and let an undecided section look like a
//  settled one.
// ══════════════════════════════════════════════════════════════════

let data: Data | undefined;
let isLoading = false;

vi.mock("./hooks", () => ({ useOrderYarnLots: () => ({ data, isLoading }) }));

const planned = (over: Partial<OrderLotRow> = {}): OrderLotRow => ({
  source: "planned",
  yarnLot: "lot1",
  lotNo: "D-4471",
  shade: "Ecru",
  materialName: "Nylon 70D",
  beamNos: [1, 2],
  sections: 4,
  ...over,
});

const issued = (over: Partial<OrderLotRow> = {}): OrderLotRow => ({
  source: "issued",
  yarnLot: "lot1",
  lotNo: "D-4471",
  shade: "Ecru",
  materialName: "Nylon 70D",
  beamNos: [1],
  quantity: 42,
  batchNo: "WB-0001",
  batchStatus: "issued",
  issuedDate: "2026-07-01T00:00:00.000Z",
  ...over,
});

const jobRow = (over: Partial<OrderLotJob> = {}): OrderLotJob => ({
  jobId: "j1",
  jobOrderNo: 12,
  jobNo: "J-12",
  status: "preparatory",
  elastics: ["20mm"],
  planned: [],
  issued: [],
  sections: { total: 0, withLot: 0, open: 0 },
  openBeamNos: [],
  ...over,
});

const shell = (over: Partial<Data> = {}): Data => ({
  orderId: "o1",
  orderNo: 1042,
  byJob: [],
  lots: [],
  sections: { total: 0, withLot: 0, open: 0 },
  ...over,
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <OrderYarnLots orderId="o1" />
    </MemoryRouter>
  );

beforeEach(() => {
  isLoading = false;
  data = undefined;
});

describe("OrderYarnLots", () => {
  it("shows the lot a job's programme chose, before anything is issued", () => {
    data = shell({
      lots: [{ ...planned(), source: "planned" }],
      byJob: [jobRow({ planned: [planned()], sections: { total: 4, withLot: 4, open: 0 } })],
      sections: { total: 4, withLot: 4, open: 0 },
    });
    renderPanel();

    expect(screen.getByText("J-12")).toBeInTheDocument();
    expect(screen.getByText("D-4471")).toBeInTheDocument();
    expect(screen.getByText("programmed")).toBeInTheDocument();
  });

  it("does not put kilograms on a lot nobody has drawn", () => {
    data = shell({
      byJob: [jobRow({ planned: [planned()], sections: { total: 4, withLot: 4, open: 0 } })],
      sections: { total: 4, withLot: 4, open: 0 },
    });
    renderPanel();
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });

  it("keeps an issued draw distinct from the programme that named it", () => {
    data = shell({
      byJob: [
        jobRow({
          planned: [planned()],
          issued: [issued()],
          sections: { total: 4, withLot: 4, open: 0 },
        }),
      ],
      sections: { total: 4, withLot: 4, open: 0 },
    });
    renderPanel();

    expect(screen.getByText("programmed")).toBeInTheDocument();
    expect(screen.getByText("issued")).toBeInTheDocument();
    expect(screen.getByText("42 kg")).toBeInTheDocument();
  });

  it("counts what is still open across the whole order", () => {
    data = shell({
      byJob: [
        jobRow({
          planned: [planned()],
          sections: { total: 6, withLot: 4, open: 2 },
          openBeamNos: [3],
        }),
      ],
      sections: { total: 6, withLot: 4, open: 2 },
    });
    renderPanel();

    expect(screen.getByText("2 sections open")).toBeInTheDocument();
    expect(screen.getByText(/beam 3/)).toBeInTheDocument();
  });

  it("tells a job with no programme apart from one with no lots chosen", () => {
    // Two different answers, and only one of them is true at a time.
    data = shell({
      byJob: [
        jobRow({ jobId: "j1", jobNo: "J-12", sections: { total: 0, withLot: 0, open: 0 } }),
        jobRow({ jobId: "j2", jobNo: "J-13", sections: { total: 3, withLot: 0, open: 3 } }),
      ],
      sections: { total: 3, withLot: 0, open: 3 },
    });
    renderPanel();

    expect(screen.getByText("No warping programme written yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Programme written, no lot chosen on any section.")
    ).toBeInTheDocument();
  });

  it("explains an empty panel rather than showing a blank card", () => {
    data = shell();
    renderPanel();
    expect(screen.getByText("No lots yet")).toBeInTheDocument();
  });

  it("flags a lot quarantined after it was programmed", () => {
    data = shell({
      byJob: [
        jobRow({
          planned: [planned({ lotStatus: "quarantined" })],
          sections: { total: 4, withLot: 4, open: 0 },
        }),
      ],
      sections: { total: 4, withLot: 4, open: 0 },
    });
    renderPanel();
    expect(screen.getByText("quarantined")).toBeInTheDocument();
  });
});
