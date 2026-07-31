import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarpingBatches } from "./WarpingBatches";
import { WarpingBatch, WarpingPlan } from "./types";
import { YarnLot } from "@/features/materials/types";

const createMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: (b: WarpingBatch) => void }) =>
    opts?.onSuccess?.(batch({ batchNo: "WB-0007" }))
);
const issueMutate = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const completeMutate = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const cancelMutate = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const toast = vi.fn();

let batches: WarpingBatch[] = [];
let lots: YarnLot[] = [];

vi.mock("./hooks", () => ({
  useWarpingBatches: () => ({ data: batches }),
  useBatchMutations: () => ({
    create: { mutate: createMutate, isPending: false },
    issue: { mutate: issueMutate, isPending: false },
    complete: { mutate: completeMutate, isPending: false },
    cancel: { mutate: cancelMutate, isPending: false },
  }),
}));
vi.mock("@/features/materials/hooks", () => ({
  useYarnLots: () => ({ data: lots, isLoading: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const lot = (over: Partial<YarnLot> = {}): YarnLot => ({
  _id: "lot1",
  rawMaterial: "mat1",
  lotNo: "D-4471",
  shade: "Off White",
  receivedQty: 100,
  consumedQty: 20,
  balance: 80,
  status: "open",
  ...over,
});

const batch = (over: Partial<WarpingBatch> = {}): WarpingBatch => ({
  _id: "b1",
  batchNo: "WB-0001",
  warping: "w1",
  beamNos: [1, 2],
  allocations: [
    { rawMaterial: "mat1", yarnLot: "lot1", lotNo: "D-4471", shade: "Off White", materialName: "Nylon 70D", quantity: 40 },
  ],
  status: "planned",
  ...over,
});

const plan: WarpingPlan = {
  _id: "p1",
  noOfBeams: 2,
  beams: [
    { beamNo: 1, totalEnds: 240, sections: [{ warpYarn: { _id: "mat1", name: "Nylon 70D" }, ends: 240 }] },
    { beamNo: 2, totalEnds: 240, sections: [{ warpYarn: { _id: "mat1", name: "Nylon 70D" }, ends: 240 }] },
  ],
};

// No default parameter here: `renderBatches(undefined)` would fall back to
// `plan` and silently test the opposite of the no-plan case.
const renderBatches = (p: WarpingPlan | undefined) =>
  render(<WarpingBatches warpingId="w1" plan={p} />);
const renderWithPlan = () => renderBatches(plan);

describe("WarpingBatches", () => {
  beforeEach(() => {
    createMutate.mockClear();
    issueMutate.mockClear();
    completeMutate.mockClear();
    cancelMutate.mockClear();
    toast.mockClear();
    batches = [];
    lots = [lot()];
  });

  it("asks for a plan before any batching", () => {
    renderBatches(undefined);
    expect(screen.getByText("No warping plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new batch/i })).toBeDisabled();
  });

  it("shows the lot each batch was drawn from", () => {
    batches = [batch()];
    renderWithPlan();
    expect(screen.getByText("WB-0001")).toBeInTheDocument();
    expect(screen.getByText(/lot D-4471/)).toBeInTheDocument();
    expect(screen.getByText("40 kg")).toBeInTheDocument();
    expect(screen.getByText(/beam 1, 2/)).toBeInTheDocument();
  });

  it("offers Issue on a planned batch and Complete once issued", () => {
    batches = [batch({ status: "issued" })];
    renderWithPlan();
    expect(screen.queryByRole("button", { name: /issue yarn/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete/i })).toBeInTheDocument();
  });

  it("issues a planned batch", async () => {
    batches = [batch()];
    renderWithPlan();
    await userEvent.click(screen.getByRole("button", { name: /issue yarn/i }));
    expect(issueMutate).toHaveBeenCalledWith("b1", expect.anything());
    expect(toast).toHaveBeenCalledWith("WB-0001 issued", "success");
  });

  it("says the yarn goes back when cancelling an issued batch", async () => {
    batches = [batch({ status: "issued" })];
    renderWithPlan();
    const row = screen.getByText("WB-0001").closest("div")!.parentElement!;
    const buttons = within(row).getAllByRole("button");
    await userEvent.click(buttons[buttons.length - 1]);
    expect(toast).toHaveBeenCalledWith(
      "WB-0001 cancelled — yarn returned to its lots",
      "success"
    );
  });

  it("leaves a completed batch with no destructive actions", () => {
    batches = [batch({ status: "completed" })];
    renderWithPlan();
    expect(screen.queryByRole("button", { name: /issue yarn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^complete$/i })).not.toBeInTheDocument();
  });

  it("creates a batch from a chosen lot and quantity", async () => {
    renderWithPlan();
    await userEvent.click(screen.getByRole("button", { name: /new batch/i }));

    await userEvent.click(screen.getByRole("checkbox", { name: /beam 1/i }));
    await userEvent.selectOptions(screen.getByLabelText(/dye lot for Nylon 70D/i), "lot1");
    await userEvent.type(screen.getByLabelText(/quantity from lot for Nylon 70D/i), "35");

    await userEvent.click(screen.getByRole("button", { name: /create batch/i }));

    expect(createMutate).toHaveBeenCalledWith(
      {
        warpingId: "w1",
        beamNos: [1],
        allocations: [{ rawMaterial: "mat1", yarnLot: "lot1", quantity: 35 }],
        remarks: undefined,
      },
      expect.anything()
    );
  });

  it("will not create a batch with no lot chosen", async () => {
    renderWithPlan();
    await userEvent.click(screen.getByRole("button", { name: /new batch/i }));
    expect(screen.getByRole("button", { name: /create batch/i })).toBeDisabled();
  });

  it("warns before the server has to refuse an overdraw", async () => {
    lots = [lot({ balance: 30 })];
    renderWithPlan();
    await userEvent.click(screen.getByRole("button", { name: /new batch/i }));
    await userEvent.selectOptions(screen.getByLabelText(/dye lot for Nylon 70D/i), "lot1");
    await userEvent.type(screen.getByLabelText(/quantity from lot for Nylon 70D/i), "50");

    expect(screen.getByText(/Only 30 kg left on lot D-4471/i)).toBeInTheDocument();
  });

  it("says so when a yarn has no open lots to draw from", async () => {
    lots = [];
    renderWithPlan();
    await userEvent.click(screen.getByRole("button", { name: /new batch/i }));
    expect(screen.getByText(/No open lots for this yarn/i)).toBeInTheDocument();
  });
});
