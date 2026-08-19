import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MachineDetailPage } from "./MachineDetailPage";
import { MachineDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  CAN ANYBODY ACTUALLY REACH THE EDIT DIALOG?
//
//  MachineEdit.test.tsx proves the dialog is right once it is open. It
//  cannot prove anybody can open it — a panel nobody mounted passes
//  every one of its own tests, which has happened more than once here.
//
//  The other thing this holds is that the control is offered at EVERY
//  status. Two of the four fields are locked on a busy loom, but the
//  other two are labels, and hiding the whole dialog because one field
//  inside it is gated would mean a typo in the manufacturer could not
//  be fixed until the job finished.
// ══════════════════════════════════════════════════════════════════

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
    updateDetails: { mutate: vi.fn(), isPending: false },
    updateElasticMap: { mutate: vi.fn(), isPending: false },
    uploadServiceBill: { mutate: vi.fn(), isPending: false },
    deleteServiceBill: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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

const editBtn = () => screen.getByRole("button", { name: /edit details/i });

beforeEach(() => { machine = detail(); });

describe("reaching the machine edit dialog", () => {
  it("offers the control on the page", () => {
    renderPage(detail());
    expect(editBtn()).toBeInTheDocument();
  });

  it("does not open the dialog until it is asked for", () => {
    renderPage(detail());
    expect(screen.queryByLabelText(/hooks per head/i)).not.toBeInTheDocument();
  });

  it("opens on the machine's stored values", async () => {
    renderPage(detail({ manufacturer: "Comez", hooks: 24 }));
    await userEvent.click(editBtn());

    expect(await screen.findByLabelText(/manufacturer/i)).toHaveValue("Comez");
    expect(screen.getByLabelText(/hooks per head/i)).toHaveValue(24);
  });

  it("is offered on a running loom too", async () => {
    // Manufacturer and purchase date are editable at any status; only
    // the ID and the hook count lock, and they say so inside.
    renderPage(detail({ status: "running" }));
    await userEvent.click(editBtn());

    expect(await screen.findByLabelText(/manufacturer/i)).toBeEnabled();
    expect(screen.getByLabelText(/machine id/i)).toBeDisabled();
  });

  it("is offered on a machine in maintenance", () => {
    renderPage(detail({ status: "maintenance" }));
    expect(editBtn()).toBeInTheDocument();
  });

  it("keeps the head-count edit separate from it", async () => {
    // Two dialogs on purpose: head count re-prices work in progress and
    // has its own confirmation. Merging them would bury that.
    renderPage(detail({ status: "free" }));
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(editBtn()).toBeInTheDocument();
  });
});
