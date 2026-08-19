import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobDetailPage } from "./JobDetailPage";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  IS THE JOB CARD ACTUALLY REACHABLE?
//
//  JobQrPrint.test.tsx proves the sheet is correct once it is on
//  screen. It cannot prove anybody can get to it — a panel that is
//  never mounted passes every one of its own tests. That has happened
//  more than once in this codebase, so the button and what it opens are
//  checked from the page itself.
//
//  It is deliberately available at every status, cancelled included: a
//  job card is printed to go on the docket, and somebody chasing a job
//  months later wants the same sheet.
// ══════════════════════════════════════════════════════════════════

vi.mock("qrcode", () => ({
  default: { toDataURL: (v: string) => Promise.resolve(`data:image/png;base64,${btoa(v)}`) },
}));

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
    plannedElastics: [{ elasticName: "20mm White", quantity: 1000 }],
    producedElastics: [],
    packedElastics: [],
    wastageElastics: [],
    shiftDetails: [],
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

describe("QR job card, from the job detail page", () => {
  it("offers the button", () => {
    renderPage(baseJob());
    expect(screen.getByRole("button", { name: /qr job card/i })).toBeInTheDocument();
  });

  it("does not print the sheet until it is asked for", () => {
    renderPage(baseJob());
    expect(screen.queryByRole("img", { name: /^QR:/ })).not.toBeInTheDocument();
  });

  it("opens a sheet carrying this job's QR", async () => {
    renderPage(baseJob());
    await userEvent.click(screen.getByRole("button", { name: /qr job card/i }));

    const img = await screen.findByRole("img", { name: /^QR:/ });
    expect(img).toHaveAttribute("alt", `QR: ${window.location.origin}/jobs/j1`);
    expect(screen.getByRole("button", { name: /^print$/i })).toBeInTheDocument();
  });

  it("is available on a cancelled job too", async () => {
    // The docket outlives the job. Hiding this at a terminal status
    // would mean the one time somebody most needs to look a job up —
    // afterwards — is the time they cannot print the card.
    renderPage(baseJob({ status: "cancelled" }));
    await userEvent.click(screen.getByRole("button", { name: /qr job card/i }));
    expect(await screen.findByRole("img", { name: /^QR:/ })).toBeInTheDocument();
  });
});
