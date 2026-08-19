import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineHeadMapEditModal } from "./MachineHeadMapEditModal";
import { MachineHeadElastic } from "./types";

const updateMutate = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const toast = vi.fn();

vi.mock("./hooks", () => ({
  // Added by the service-analytics panel the list page now mounts.
  useServiceAnalytics: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useProductionSeries: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineSpend: () => ({ data: undefined, isLoading: true, isError: false, error: null, refetch: () => {} }),
  useMachineMutations: () => ({
    updateElasticMap: { mutate: updateMutate, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

// The running job's planned elastics feed the per-head options.
vi.mock("@/features/jobs/hooks", () => ({
  useJob: () => ({
    data: {
      plannedElastics: [
        { elasticId: "e1", elasticName: "E-100" },
        { elasticId: "e2", elasticName: "E-200" },
      ],
    },
  }),
}));

const current: MachineHeadElastic[] = [
  { head: 1, elastic: { _id: "e1", name: "E-100" } },
  { head: 2, elastic: { _id: "e1", name: "E-100" } },
];

describe("MachineHeadMapEditModal", () => {
  beforeEach(() => {
    updateMutate.mockClear();
    toast.mockClear();
  });

  it("saves a head→elastic map for every head (1-based)", async () => {
    const user = userEvent.setup();
    render(
      <MachineHeadMapEditModal
        machineId="m1"
        heads={2}
        current={current}
        jobId="j1"
        onClose={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /save map/i }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m1",
        elastics: [
          { head: 1, elastic: "e1" },
          { head: 2, elastic: "e1" },
        ],
      }),
      expect.anything()
    );
  });

  it("spreads the job's elastics round-robin across heads", async () => {
    const user = userEvent.setup();
    render(
      <MachineHeadMapEditModal
        machineId="m1"
        heads={4}
        current={current}
        jobId="j1"
        onClose={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: /spread elastics evenly/i }));
    await user.click(screen.getByRole("button", { name: /save map/i }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        elastics: [
          { head: 1, elastic: "e1" },
          { head: 2, elastic: "e2" },
          { head: 3, elastic: "e1" },
          { head: 4, elastic: "e2" },
        ],
      }),
      expect.anything()
    );
  });
});
