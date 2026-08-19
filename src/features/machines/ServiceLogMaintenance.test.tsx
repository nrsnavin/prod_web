import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MachineDetailPage } from "./MachineDetailPage";
import { MachineDetail } from "./types";

const addLogMutate = vi.fn(
  (
    _a: unknown,
    opts?: { onSuccess?: (r: { statusChanged: boolean }) => void }
  ) => opts?.onSuccess?.({ statusChanged: true })
);
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
    addServiceLog: { mutate: addLogMutate, isPending: false },
    uploadServiceBill: { mutate: vi.fn(), isPending: false },
    deleteServiceBill: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./MachineHealth", () => ({ MachineHealthCard: () => null }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

const detail = (over: Partial<MachineDetail> = {}): MachineDetail => ({
  id: "M-01",
  status: "free",
  manufacturer: "Comez",
  heads: 8,
  hooks: 24,
  elastics: [],
  result: [],
  serviceLogs: [],
  ...over,
});

const openLogForm = async (user: ReturnType<typeof userEvent.setup>) => {
  // A real route, not just a history entry — the page reads :id via useParams.
  render(
    <MemoryRouter initialEntries={["/machines/m1"]}>
      <Routes>
        <Route path="/machines/:id" element={<MachineDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
  await user.click(screen.getByRole("button", { name: /add log/i }));
};

describe("Sending a machine for service", () => {
  beforeEach(() => {
    addLogMutate.mockClear();
    toast.mockClear();
    machine = detail();
  });

  it("offers to take a free machine off the floor, ticked by default", async () => {
    const user = userEvent.setup();
    await openLogForm(user);

    const box = screen.getByRole("checkbox", { name: /send the machine to maintenance/i });
    expect(box).toBeChecked();
  });

  it("books the work in and sends the machine to maintenance together", async () => {
    const user = userEvent.setup();
    await openLogForm(user);

    await user.type(screen.getByLabelText(/description/i), "Replaced drive belt");
    await user.click(screen.getByRole("button", { name: /^save log$/i }));

    await waitFor(() => expect(addLogMutate).toHaveBeenCalled());
    expect(addLogMutate.mock.calls[0][0]).toMatchObject({
      machineId: "m1",
      body: expect.objectContaining({
        description: "Replaced drive belt",
        setMaintenance: true,
      }),
    });
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/sent to maintenance/i),
      "success"
    );
  });

  it("can record the work without pulling the machine", async () => {
    const user = userEvent.setup();
    await openLogForm(user);

    await user.click(screen.getByRole("checkbox", { name: /send the machine to maintenance/i }));
    await user.type(screen.getByLabelText(/description/i), "Routine check");
    await user.click(screen.getByRole("button", { name: /^save log$/i }));

    await waitFor(() => expect(addLogMutate).toHaveBeenCalled());
    expect(addLogMutate.mock.calls[0][0]).toMatchObject({
      body: expect.objectContaining({ setMaintenance: false }),
    });
  });

  it("does not offer the option for a machine already in maintenance", async () => {
    machine = detail({ status: "maintenance" });
    const user = userEvent.setup();
    await openLogForm(user);

    expect(screen.queryByRole("checkbox", { name: /send the machine/i })).not.toBeInTheDocument();
    expect(screen.getByText(/already under maintenance/i)).toBeInTheDocument();
  });

  it("tells the user to stop the job first when the machine is running", async () => {
    machine = detail({ status: "running" });
    const user = userEvent.setup();
    await openLogForm(user);

    expect(screen.queryByRole("checkbox", { name: /send the machine/i })).not.toBeInTheDocument();
    expect(screen.getByText(/stop the job first/i)).toBeInTheDocument();
  });
});
