import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnterProductionModal } from "./ShiftPlanDetailPage";
import { ShiftPlanDetail, ShiftPlanMachineRow } from "./types";

const verifyMutate = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const toast = vi.fn();

vi.mock("./hooks", () => ({
  useShiftMutations: () => ({ verify: { mutate: verifyMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const plan: ShiftPlanDetail = {
  _id: "p1",
  date: "2026-07-23T00:00:00.000Z",
  shift: "DAY",
  totalProduction: 0,
  operatorCount: 1,
  machines: [],
};
const row: ShiftPlanMachineRow = {
  id: "sd-1",
  machineId: "m1",
  machineName: "LOOM-07",
  jobOrderNo: 42,
  operatorName: "Ravi",
  production: 0,
  timer: "",
  status: "open",
};

describe("EnterProductionModal (add production to an open shift)", () => {
  beforeEach(() => {
    verifyMutate.mockClear();
    toast.mockClear();
  });

  it("disables Save until a production value is entered", () => {
    render(<EnterProductionModal plan={plan} row={row} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /save production/i })).toBeDisabled();
  });

  it("verifies the shift detail with the entered meters", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EnterProductionModal plan={plan} row={row} onClose={onClose} />);

    await user.type(screen.getByLabelText(/Production \(m\)/i), "1250");
    await user.click(screen.getByRole("button", { name: /save production/i }));

    expect(verifyMutate).toHaveBeenCalledWith(
      expect.objectContaining({ shiftId: "sd-1", productionMeters: 1250 }),
      expect.anything()
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the machine and operator context", () => {
    render(<EnterProductionModal plan={plan} row={row} onClose={() => {}} />);
    expect(screen.getByText("LOOM-07")).toBeInTheDocument();
    expect(screen.getByText(/Ravi/)).toBeInTheDocument();
  });
});
