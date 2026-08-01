import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MachineAssignModal } from "./MachineAssignModal";
import { JobDetail, MachineAssignResult } from "./types";

// Assigning a machine used to flip the job straight to weaving, which
// walked around the readiness gate entirely — the machine screen was
// the open door beside the locked one. The server now withholds the
// status when preparation is unfinished, and the screen has to say so
// rather than announcing a move that did not happen.

const toast = vi.fn();
let result: MachineAssignResult;

const planMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: (r: MachineAssignResult) => void }) =>
    opts?.onSuccess?.(result)
);

vi.mock("./hooks", () => ({
  useJobMutations: () => ({ planWeaving: { mutate: planMutate, isPending: false } }),
}));
// The free-machine list is fetched inside the modal, so the transport is
// stubbed rather than a hook.
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return {
    ...actual,
    httpClient: {
      get: vi.fn().mockResolvedValue({
        success: true,
        machines: [{ _id: "m1", ID: "M-1", NoOfHead: 1, manufacturer: "Acme" }],
      }),
    },
  };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const job = {
  id: "j1",
  jobNo: "J-12",
  status: "preparatory",
  plannedElastics: [{ elasticId: "e1", elasticName: "20mm", quantity: 500 }],
} as unknown as JobDetail;

const renderModal = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MachineAssignModal job={job} open onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

/** Open the machine combobox and take the only free machine. Picking one
 *  auto-fills the head mapping, so the submit button becomes enabled. */
const pickMachine = async (user: ReturnType<typeof userEvent.setup>) => {
  // The trigger takes its accessible name from the placeholder —
  // the label is not associated with the button.
  await user.click(await screen.findByRole("button", { name: /select machine/i }));
  await user.click(await screen.findByRole("option", { name: /M-1/ }));
};

beforeEach(() => {
  toast.mockClear();
  planMutate.mockClear();
  result = { success: true, message: "", weavingHeld: null };
});

describe("assigning a machine to an unprepared job", () => {
  it("reports the job stayed in preparatory, with the reason", async () => {
    const user = userEvent.setup();
    result = {
      success: true,
      message: "",
      weavingHeld: { blockers: ["The covering is in progress, not completed"] },
    };
    renderModal();

    await pickMachine(user);
    await user.click(screen.getByRole("button", { name: /^assign machine$/i }));

    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/stays in preparatory.*covering is in progress/i),
      "info"
    );
    // Never claims a move that did not happen.
    expect(toast).not.toHaveBeenCalledWith(
      expect.stringMatching(/is now weaving/i),
      expect.anything()
    );
  });

  it("still says weaving when the server did move it", async () => {
    const user = userEvent.setup();
    renderModal();

    await pickMachine(user);
    await user.click(screen.getByRole("button", { name: /^assign machine$/i }));

    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/is now weaving/i),
      "success"
    );
  });
});
