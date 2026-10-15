import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobDetailPage } from "./JobDetailPage";
import type { JobDetail } from "./types";

// A job's warping and covering are their own records, planned and
// completed on their own pages. The job names their status; it should
// also take you there.

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
let user: { role: string; department: string; features?: string[] } | null = { role: "admin", department: "admin" };
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));

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

beforeEach(() => {
  useJob.mockReset();
  user = { role: "admin", department: "admin" };
});

describe("the job's warping and covering", () => {
  it("link to their own pages", () => {
    renderPage(baseJob({ status: "preparatory", warping: { _id: "w9", status: "open" }, covering: { _id: "c9", status: "completed" } }));
    expect(screen.getByRole("link", { name: "Open the warping (open)" })).toHaveAttribute("href", "/warping/w9");
    expect(screen.getByRole("link", { name: "Open the covering (completed)" })).toHaveAttribute("href", "/covering/c9");
  });

  it("show only the status to someone who cannot open those screens", () => {
    user = { role: "accounts", department: "finance", features: ["/jobs"] };
    renderPage(baseJob({ status: "preparatory", warping: { _id: "w9", status: "open" } }));
    expect(screen.queryByRole("link", { name: /Open the warping/ })).not.toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("say None when the job has none", () => {
    renderPage(baseJob({ warping: null, covering: null }));
    expect(screen.getAllByText("None")).toHaveLength(2);
  });
});
