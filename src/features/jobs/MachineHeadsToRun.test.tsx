import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MachineAssignModal } from "./MachineAssignModal";
import { headsLabel } from "./JobDetailPage";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  RUNNING A JOB ON FEWER HEADS THAN THE LOOM HAS
//
//  A wide elastic may fit on only 6 heads of an 8-head loom. The head
//  plan sent is just those heads; production is then counted on them.
//  The job's own machine is offered too, so its heads can be re-planned
//  without moving it.
// ══════════════════════════════════════════════════════════════════

const mutate = vi.fn();
vi.mock("./hooks", () => ({ useJobMutations: () => ({ planWeaving: { mutate, isPending: false } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return {
    ...actual,
    httpClient: {
      get: vi.fn().mockResolvedValue({
        success: true,
        machines: [{ _id: "m2", ID: "M-2", manufacturer: "Comez", NoOfHead: 8, NoOfHooks: 24, status: "free" }],
      }),
      post: vi.fn(),
    },
  };
});

const job = (over: Partial<JobDetail> = {}): JobDetail =>
  ({
    id: "j1", jobOrderNo: 12, jobNo: "J-12", status: "weaving", customerName: "Acme",
    plannedElastics: [{ elasticId: "e1", elasticName: "50mm Wide", quantity: 500 }],
    producedElastics: [], packedElastics: [], wastageElastics: [], shiftDetails: [], wastages: [], packingDetails: [],
    machine: null,
    ...over,
  }) as unknown as JobDetail;

const renderModal = (j: JobDetail) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <MachineAssignModal job={j} open onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => mutate.mockClear());

describe("heads to run", () => {
  it("defaults to every head; choosing 6 of 8 sends just heads 1–6", async () => {
    const user = userEvent.setup();
    renderModal(job());
    await user.click(await screen.findByRole("button", { name: /select machine/i }));
    await user.click(await screen.findByRole("option", { name: /M-2/ }));

    const heads = screen.getByLabelText("Heads to run");
    expect(heads).toHaveValue("8");
    await user.selectOptions(heads, "6");
    expect(screen.getByText(/Heads 7–8 stay empty. Production is counted on 6 heads./)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: /Elastic on head/ })).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: /^assign machine$/i }));
    const sent = mutate.mock.calls[0][0];
    expect(Object.keys(sent.headElasticMap)).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(Object.values(sent.headElasticMap).every((v) => v === "e1")).toBe(true);
  });

  it("offers the job's own machine, starting from its current plan, to re-plan in place", async () => {
    const user = userEvent.setup();
    renderModal(job({
      machine: {
        machineId: "m1", machineName: "M-1", machineNoOfHead: 8, manufacturer: "Comez",
        headsInUse: 6, headPlan: [1, 2, 3, 4, 5, 6].map((head) => ({ head, elastic: "e1" })),
      },
    }));
    await user.click(await screen.findByRole("button", { name: /select machine/i }));
    await user.click(await screen.findByRole("option", { name: /M-1 .*\(current\)/ }));
    expect(screen.getByLabelText("Heads to run")).toHaveValue("6");
    await user.selectOptions(screen.getByLabelText("Heads to run"), "4");
    await user.click(screen.getByRole("button", { name: /save head plan/i }));
    expect(mutate.mock.calls[0][0]).toMatchObject({ machineId: "m1" });
    expect(Object.keys(mutate.mock.calls[0][0].headElasticMap)).toHaveLength(4);
  });
});

describe("the job page's machine line", () => {
  it("says 6 of 8 heads only when fewer run", () => {
    expect(headsLabel(6, 8)).toBe("6 of 8 heads");
    expect(headsLabel(8, 8)).toBe("8 heads");
    expect(headsLabel(undefined, 8)).toBe("8 heads");
  });
});
