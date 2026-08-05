import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobDetailPage } from "./JobDetailPage";
import type { JobDetail } from "./types";

// "Shifts on this job" on an OUTSOURCED job would otherwise render an
// empty table reading "No shifts recorded yet" — which says nothing has
// been entered, and invites someone to go hunting for the missing
// entries. A vendor-made job runs no shifts here at all, so the card
// names the vendor instead. In-house jobs keep the shift list unchanged.

const useJob = vi.fn();
vi.mock("./hooks", () => ({
  useJob: (id: string) => useJob(id),
  useJobMutations: () => ({
    updateStatus: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
    planWeaving: { mutate: vi.fn(), isPending: false },
    setProductionMode: { mutate: vi.fn(), isPending: false },
  }),
  useWeavingReadiness: () => ({ data: undefined, isLoading: false }),
  useJobSummary: () => ({ data: [], isLoading: false }),
}));
vi.mock("./JobYarnLots", () => ({ JobYarnLots: () => null }));
vi.mock("./QcPanel", () => ({ QcPanel: () => null }));
vi.mock("./MrpShortfallPo", () => ({ MrpShortfallPo: () => null }));
// Pulls the free-machine list over HTTP; irrelevant to this card.
vi.mock("./MachineAssignModal", () => ({ MachineAssignModal: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const baseJob = (over: Partial<JobDetail> = {}): JobDetail =>
  ({
    id: "j1",
    jobOrderNo: 42,
    jobNo: "J-42",
    status: "weaving",
    customerName: "Acme Ltd",
    productionMode: "in_house",
    elastics: [],
    shiftDetails: [
      { id: "s1", date: "2026-08-05", dateLabel: "05 Aug 2026", shift: "DAY",
        machineName: "M-01", operatorName: "Ravi Kumar",
        productionMeters: 120, verified: true, timer: "08:00:00", status: "closed" },
    ],
    shiftSummary: {
      shifts: 1, produced: 120, workedMinutes: 480,
      byShift: { DAY: 120, NIGHT: 0 },
      closed: 1, awaitingVerification: 0, open: 0,
      metresPerHour: 15, firstDate: null, lastDate: null,
    },
    wastages: [],
    ...over,
  }) as unknown as JobDetail;

function renderPage(job: JobDetail) {
  useJob.mockReturnValue({ data: job, isLoading: false, isError: false });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/jobs/j1"]}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => useJob.mockReset());

describe('"Shifts on this job" — outsourced vs in-house', () => {
  it("names the vendor instead of an empty shift table when outsourced", () => {
    renderPage(baseJob({ productionMode: "outsource", outsourceVendor: "Sunrise Weaving", shiftDetails: [] }));

    expect(screen.getByText(/Outsourced — Sunrise Weaving/)).toBeInTheDocument();
    expect(screen.getByText(/produced by a vendor, so no shifts run against it here/i)).toBeInTheDocument();
    // The misleading empty state must be gone.
    expect(screen.queryByText(/No shifts recorded yet/i)).not.toBeInTheDocument();
  });

  it("still marks it outsourced when no vendor was recorded", () => {
    renderPage(baseJob({ productionMode: "outsource", shiftDetails: [] }));
    expect(screen.getByText(/Outsourced/)).toBeInTheDocument();
    expect(screen.queryByText(/No shifts recorded yet/i)).not.toBeInTheDocument();
  });

  it("keeps the shift list for an in-house job", () => {
    renderPage(baseJob());
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.queryByText(/produced by a vendor/i)).not.toBeInTheDocument();
  });

  // Older job documents predate the field; they are in-house work and
  // must keep their shifts rather than being hidden behind a vendor panel.
  it("treats a missing production mode as in-house", () => {
    renderPage(baseJob({ productionMode: undefined }));
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.queryByText(/produced by a vendor/i)).not.toBeInTheDocument();
  });
});
