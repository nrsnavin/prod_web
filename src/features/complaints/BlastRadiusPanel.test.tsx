import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlastRadiusPanel } from "./BlastRadiusPanel";
import type { ExposureRow, TraceResult } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A PANEL THAT PRODUCES A CALL LIST
//
//  What this renders is acted on within minutes: somebody reads it and
//  telephones other customers, or runs down to the floor to stop a
//  beam. So the tests are about what the reader is led to do.
//
//    • the containable list comes FIRST, above the bad news
//    • an uncertain row says so on its face, because the alternative is
//      apologising to a customer who received nothing wrong
//    • a programmed lot is visibly not an issued one
//    • "no lot recorded" never reads as "nobody else is affected"
// ══════════════════════════════════════════════════════════════════

const trace = vi.fn();
// The service returns the httpClient envelope and the panel unwraps
// `.data`. Wrapping here keeps every test below stating just the trace
// it cares about.
vi.mock("./api", () => ({
  complaintService: {
    trace: async (id: string) => ({ success: true, data: await trace(id) }),
  },
}));

const row = (over: Partial<ExposureRow> = {}): ExposureRow => ({
  jobId: "j1", jobNo: 101, jobStatus: "weaving", finishedNotShipped: false,
  orderId: "o1", orderNo: 55, customerId: "c1", customerName: "Bharat Mills",
  elastics: [{ id: "e1", name: "20mm White" }],
  exposure: "inHouse", certain: true, via: ["issued"], challans: [],
  ...over,
});

const data = (over: Partial<TraceResult> = {}): TraceResult => ({
  ok: true,
  complaint: {
    complaintId: "x1", date: "2026-08-01T00:00:00Z", category: "shade",
    status: "Open", reason: "Shade band", customerName: "Anand",
    jobNo: 99, orderNo: 40, elasticName: "20mm White",
  },
  lots: [{
    yarnLot: "l1", lotNo: "D-4471", shade: "Indigo", materialName: "Nylon 70D",
    source: "issued", elasticIds: ["e1"], elasticNames: ["20mm White"],
    attribution: "elastic",
  }],
  exposure: { delivered: [], inTransit: [], inHouse: [] },
  summary: {
    lots: 1, otherJobs: 0, otherCustomers: 0,
    delivered: 0, inTransit: 0, inHouse: 0, uncertain: 0,
  },
  caveats: [],
  ...over,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BlastRadiusPanel complaintId="x1" />
    </QueryClientProvider>
  );
}

beforeEach(() => { trace.mockReset(); });

describe("BlastRadiusPanel", () => {
  it("puts the containable list above the delivered one", async () => {
    // The ordering is the argument. The eye goes to the bad news, and by
    // the time somebody has finished reading it the beam is on the loom.
    trace.mockResolvedValue(data({
      exposure: {
        delivered: [row({ jobId: "d1", customerName: "Delivered Co", exposure: "delivered" })],
        inTransit: [],
        inHouse: [row({ jobId: "h1", customerName: "Onfloor Co" })],
      },
      summary: { lots: 1, otherJobs: 2, otherCustomers: 2, delivered: 1, inTransit: 0, inHouse: 1, uncertain: 0 },
    }));

    renderPanel();
    const stillHere = await screen.findByText(/still here/i);
    const delivered = screen.getByText(/already delivered/i);

    expect(stillHere.compareDocumentPosition(delivered))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("marks an uncertain row on its face", async () => {
    trace.mockResolvedValue(data({
      exposure: {
        delivered: [row({ exposure: "delivered", certain: false })],
        inTransit: [], inHouse: [],
      },
      summary: { lots: 1, otherJobs: 1, otherCustomers: 1, delivered: 1, inTransit: 0, inHouse: 0, uncertain: 1 },
      caveats: ["1 job(s) share an order and a product with another job — marked uncertain."],
    }));

    renderPanel();
    expect(await screen.findByText(/may not be this job/i)).toBeInTheDocument();
    expect(screen.getByText(/marked uncertain/i)).toBeInTheDocument();
  });

  it("a certain row carries no hedge", async () => {
    trace.mockResolvedValue(data({
      exposure: {
        delivered: [row({ exposure: "delivered", certain: true })],
        inTransit: [], inHouse: [],
      },
      summary: { lots: 1, otherJobs: 1, otherCustomers: 1, delivered: 1, inTransit: 0, inHouse: 0, uncertain: 0 },
    }));

    renderPanel();
    await screen.findByText("Bharat Mills");
    expect(screen.queryByText(/may not be this job/i)).not.toBeInTheDocument();
  });

  it("distinguishes a programmed lot from an issued one", async () => {
    // A programme can still be rewritten; issued yarn cannot be put back
    // on the rack. That difference is the whole containment decision.
    trace.mockResolvedValue(data({
      exposure: {
        delivered: [], inTransit: [],
        inHouse: [row({ via: ["planned"] })],
      },
      summary: { lots: 1, otherJobs: 1, otherCustomers: 1, delivered: 0, inTransit: 0, inHouse: 1, uncertain: 0 },
    }));

    renderPanel();
    expect(await screen.findByText(/lot programmed/i)).toBeInTheDocument();
    expect(screen.queryByText(/lot issued/i)).not.toBeInTheDocument();
  });

  it("shows a job that is finished but has not shipped as still pullable", async () => {
    trace.mockResolvedValue(data({
      exposure: {
        delivered: [], inTransit: [],
        inHouse: [row({ jobStatus: "completed", finishedNotShipped: true })],
      },
      summary: { lots: 1, otherJobs: 1, otherCustomers: 1, delivered: 0, inTransit: 0, inHouse: 1, uncertain: 0 },
    }));

    renderPanel();
    expect(await screen.findByText(/finished, still here/i)).toBeInTheDocument();
  });

  it("keeps in-transit separate from delivered", async () => {
    trace.mockResolvedValue(data({
      exposure: {
        delivered: [],
        inTransit: [row({ exposure: "inTransit", customerName: "Transit Co" })],
        inHouse: [],
      },
      summary: { lots: 1, otherJobs: 1, otherCustomers: 1, delivered: 0, inTransit: 1, inHouse: 0, uncertain: 0 },
    }));

    renderPanel();
    const heading = await screen.findByText(/in transit/i);
    const section = heading.closest("div")!.parentElement!;
    expect(within(section).getByText("Transit Co")).toBeInTheDocument();
  });

  it("prints the caveat when no lot is recorded, so it does not read as safe", async () => {
    trace.mockResolvedValue(data({
      lots: [],
      summary: { lots: 0, otherJobs: 0, otherCustomers: 0, delivered: 0, inTransit: 0, inHouse: 0, uncertain: 0 },
      caveats: [
        "No yarn lot is recorded against this job — this is not evidence that no other order is affected.",
      ],
    }));

    renderPanel();
    expect(await screen.findByText(/not evidence that no other order is affected/i))
      .toBeInTheDocument();
  });

  it("says so plainly when there is no trail at all", async () => {
    trace.mockResolvedValue({
      ok: false, reason: "no-job",
      message: "This complaint is not linked to a job, so there is no trail to follow.",
    } as TraceResult);

    renderPanel();
    expect(await screen.findByText(/no trail to follow/i)).toBeInTheDocument();
  });

  it("shows the lot number and whether it was issued", async () => {
    trace.mockResolvedValue(data());
    renderPanel();
    const chip = await screen.findByText("D-4471");
    expect(chip).toBeInTheDocument();
    expect(screen.getByText(/· issued/)).toBeInTheDocument();
  });

  it("counts other jobs and other customers", async () => {
    trace.mockResolvedValue(data({
      exposure: {
        delivered: [row({ jobId: "a", customerId: "c1", customerName: "A", exposure: "delivered" })],
        inTransit: [],
        inHouse: [row({ jobId: "b", customerId: "c2", customerName: "B" })],
      },
      summary: { lots: 2, otherJobs: 2, otherCustomers: 2, delivered: 1, inTransit: 0, inHouse: 1, uncertain: 0 },
    }));

    renderPanel();
    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.getByText(/2 other customers/i)).toBeInTheDocument();
  });
});
