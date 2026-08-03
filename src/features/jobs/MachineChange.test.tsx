import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MachineAssignModal } from "./MachineAssignModal";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  MOVING A RUNNING JOB TO ANOTHER MACHINE
//
//  A machine can break down mid-run. The server used to refuse the
//  move outright, so the job had to be walked back a stage before it
//  could be put on a working machine; the button was hidden on a
//  weaving job for the same reason.
//
//  Both are open now. What matters in the UI is that a MOVE reads as a
//  move: the operator has to know what happens to the machine the job
//  is leaving, or it will feel like the job might end up on neither.
// ══════════════════════════════════════════════════════════════════

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return {
    ...actual,
    httpClient: {
      get: vi.fn().mockResolvedValue({ success: true, machines: [] }),
      post: vi.fn(),
    },
  };
});
vi.mock("./hooks", () => ({
  useJobMutations: () => ({
    planWeaving: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const job = (over: Partial<JobDetail> = {}): JobDetail =>
  ({
    id: "j1",
    jobOrderNo: 12,
    jobNo: "J-12",
    status: "weaving",
    customerName: "Acme",
    plannedElastics: [{ elasticId: "e1", elasticName: "20mm", quantity: 500 }],
    producedElastics: [],
    packedElastics: [],
    wastageElastics: [],
    shiftDetails: [],
    wastages: [],
    packingDetails: [],
    machine: {
      machineId: "m1",
      machineName: "M-7",
      machineNoOfHead: 2,
    },
    ...over,
  }) as unknown as JobDetail;

const renderModal = (j: JobDetail) =>
  render(
    // The modal loads the free-machine list itself, so it needs a
    // client. Retries off — a failed fetch here should surface, not be
    // quietly attempted three more times.
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <MachineAssignModal job={j} open onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => vi.clearAllMocks());

describe("the machine dialog on a job that already has one", () => {
  it("frames it as a change, not a fresh assignment", () => {
    renderModal(job());
    expect(screen.getByText(/Change machine — J-12/)).toBeInTheDocument();
  });

  it("says which machine the job is leaving, and that it will be freed", () => {
    // Without this, moving a running job feels like it might strand it
    // on neither machine.
    renderModal(job());
    expect(screen.getByText(/is on/)).toBeInTheDocument();
    expect(screen.getByText(/frees M-7/)).toBeInTheDocument();
  });
});

describe("the machine dialog on a job with no machine", () => {
  it("still reads as an assignment", () => {
    renderModal(job({ machine: null }));
    expect(screen.getByText(/Assign machine — J-12/)).toBeInTheDocument();
    expect(screen.queryByText(/frees/)).not.toBeInTheDocument();
  });
});
