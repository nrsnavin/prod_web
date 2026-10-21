import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MachineDetailPage } from "./MachineDetailPage";
import { MachineDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHO IS ALLOWED TO CHANGE THE HEAD COUNT, AND WHEN — AND LOADING
//
//  The head count is how many heads the loom HAS. Production is counted
//  by the heads the job's plan RUNS, so the count can change while the
//  loom is running, down to the heads that plan uses; the server holds
//  that line. A loom just given a job can be LOADING: nothing counted
//  until it is marked running, from this page.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const setLoadingMutate = vi.fn();
let machine: MachineDetail;

vi.mock("./hooks", () => ({
  // Added by the service-analytics panel the list page now mounts.
  useServiceAnalytics: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useProductionSeries: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineSpend: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachine: () => ({ data: machine, isLoading: false, isError: false, error: null }),
  useServiceBills: () => ({ data: [], isLoading: false }),
  useMachineMutations: () => ({
    setLoading: { mutate: setLoadingMutate, isPending: false },
    setStatus: { mutate: vi.fn(), isPending: false },
    addServiceLog: { mutate: vi.fn(), isPending: false },
    updateHeads: { mutate: vi.fn(), isPending: false },
    updateElasticMap: { mutate: vi.fn(), isPending: false },
    uploadServiceBill: { mutate: vi.fn(), isPending: false },
    deleteServiceBill: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./MachineHealth", () => ({ MachineHealthCard: () => null }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

const detail = (over: Partial<MachineDetail> = {}): MachineDetail => ({
  id: "LOOM-07",
  status: "free",
  manufacturer: "Comez",
  heads: 8,
  hooks: 24,
  elastics: [],
  result: [],
  serviceLogs: [],
  ...over,
});

function renderPage(m: MachineDetail) {
  machine = m;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
      <MemoryRouter initialEntries={["/machines/abc123"]}>
        <Routes>
          <Route path="/machines/:id" element={<MachineDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => { toast.mockReset(); });

describe("editing the head count from the machine page", () => {
  it("offers the edit while the loom is free", () => {
    renderPage(detail({ status: "free" }));
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("opens the dialog on the loom's current count", async () => {
    renderPage(detail({ status: "free", heads: 8 }));
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    expect(await screen.findByRole("spinbutton", { name: /number of heads/i }))
      .toHaveValue(8);
  });

  it("is offered on a running loom too: production is counted by the job's head plan", () => {
    renderPage(detail({ status: "running" }));
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("says how many heads are running when the plan uses fewer than the loom has", () => {
    renderPage(detail({
      status: "running", heads: 8,
      elastics: [1, 2, 3, 4, 5, 6].map((head) => ({ head, elastic: { _id: `e${head}`, name: "50mm Wide" } })),
    }));
    expect(screen.getByText("6 running of 8")).toBeInTheDocument();
    expect(screen.getByText(/6 of 8 heads running/)).toBeInTheDocument();
  });

  it("still shows the count whatever the status", () => {
    // The number is a fact about the machine. Only changing it is gated.
    renderPage(detail({ status: "running", heads: 12 }));
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("a loom being loaded for its job", () => {
  it("says so, and offers Mark as running", async () => {
    setLoadingMutate.mockClear();
    renderPage(detail({ status: "running", loading: true, loadingSince: "2026-10-21T04:30:00Z" }));
    expect(screen.getByText(/no production is entered or counted/)).toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /mark as running/i }));
    expect(setLoadingMutate.mock.calls[0][0]).toEqual({ id: "abc123", loading: false });
  });

  it("a running loom can be put back to loading", async () => {
    setLoadingMutate.mockClear();
    renderPage(detail({ status: "running", loading: false }));
    expect(screen.queryByRole("button", { name: /mark as running/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /mark as loading/i }));
    expect(setLoadingMutate.mock.calls[0][0]).toEqual({ id: "abc123", loading: true });
  });
});
