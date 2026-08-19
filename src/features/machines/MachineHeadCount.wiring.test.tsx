import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MachineDetailPage } from "./MachineDetailPage";
import { MachineDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHO IS ALLOWED TO CHANGE THE HEAD COUNT, AND WHEN
//
//  The server permits this only while the loom is FREE, and for a good
//  reason: the planner derives a weaving rate from head count, the ETA
//  posterior is keyed on it, and the head→elastic map is indexed by it.
//  Changing it under a running job re-prices work already in progress.
//
//  The screen has to AGREE with that rule rather than discover it.
//  Offering an edit that the server will refuse is a worse version of
//  the same conversation — the user types a number, commits to it, and
//  is then told no. So on a busy loom the control is not there at all,
//  and the reason is on the row in its place.
//
//  A component test cannot prove any of this: the modal itself is
//  perfectly happy to open on a running machine. Only the page decides.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
let machine: MachineDetail;

vi.mock("./hooks", () => ({
  // Added by the service-analytics panel the list page now mounts.
  useServiceAnalytics: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useProductionSeries: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineSpend: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachine: () => ({ data: machine, isLoading: false, isError: false, error: null }),
  useServiceBills: () => ({ data: [], isLoading: false }),
  useMachineMutations: () => ({
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
    <MemoryRouter initialEntries={["/machines/abc123"]}>
      <Routes>
        <Route path="/machines/:id" element={<MachineDetailPage />} />
      </Routes>
    </MemoryRouter>
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

  it("does not offer it on a running loom, and says why", () => {
    // The rule stated before the attempt, not after it.
    renderPage(detail({ status: "running" }));
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/locked while running/i)).toBeInTheDocument();
  });

  it("nor on one in maintenance", () => {
    renderPage(detail({ status: "maintenance" }));
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/locked while maintenance/i)).toBeInTheDocument();
  });

  it("still shows the count whatever the status", () => {
    // The number is a fact about the machine. Only changing it is gated.
    renderPage(detail({ status: "running", heads: 12 }));
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
