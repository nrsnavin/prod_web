import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ShiftPlanDetailPage } from "./ShiftPlanDetailPage";
import type { ShiftPlanDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A plan made from the floor, on the office's plan page: whose it
//  is, whether the floor has finished it and which looms were free,
//  and the Confirm button that turns the draft into the shift's plan.
// ══════════════════════════════════════════════════════════════════

const confirmMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const verifyAsync = vi.fn(async () => ({}));
let plan: ShiftPlanDetail;
vi.mock("./hooks", () => ({
  useShiftPlan: () => ({ data: plan, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useShiftMutations: () => ({
    confirmPlan: { mutate: confirmMutate, isPending: false },
    deletePlan: { mutate: vi.fn(), isPending: false },
    verify: { mutate: vi.fn(), mutateAsync: verifyAsync, isPending: false },
  }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/features/productionModel/ExpectedOutput", () => ({ ExpectedOutput: () => null }));
vi.mock("./SheetUploadModal", () => ({ SheetUploadModal: () => null }));

const base: ShiftPlanDetail = {
  _id: "p1", date: "2026-10-21T00:00:00.000Z", shift: "DAY", description: "From the floor (Kumar)",
  status: "draft", finalized: false, source: "floor", floor: null, totalProduction: 820, operatorCount: 1,
  machines: [{ id: "d1", machineId: "m1", machineName: "L1", jobOrderNo: 12, operatorName: "Ravi", production: 820, timer: "7:30:00", status: "pending_verification" }],
};
const open = () => render(
  <MemoryRouter initialEntries={["/shift-plans/p1"]}>
    <Routes><Route path="/shift-plans/:id" element={<ShiftPlanDetailPage />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => { confirmMutate.mockClear(); verifyAsync.mockClear(); toast.mockClear(); });

describe("a plan made from the floor", () => {
  it("says it is still being entered, and is a draft to confirm", async () => {
    plan = base;
    open();
    expect(screen.getByText("Draft — not confirmed yet")).toBeInTheDocument();
    expect(screen.getByText("Made from the floor")).toBeInTheDocument();
    expect(screen.getByText(/A draft being entered on the floor, loom by loom/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /confirm plan/i }));
    expect(confirmMutate).toHaveBeenCalledWith("p1", expect.anything());
    expect(toast).toHaveBeenCalledWith("Shift plan confirmed", "success");
  });

  it("once every loom is entered, names who finished it and the looms that were free", () => {
    plan = { ...base, floor: { completedAt: "2026-10-21T14:10:00.000Z", completedBy: "Kumar", freeMachines: [{ id: "m2", ID: "L2", why: "No job on this loom." }, { id: "m5", ID: "L5", why: "No job on this loom." }], loadingMachines: [{ id: "m3", ID: "L3", operatorName: "Sita" }, { id: "m6", ID: "L6", operatorName: "" }] } };
    open();
    expect(screen.getByText("Being loaded: L3 (Sita), L6 (nobody put on it).")).toBeInTheDocument();
    expect(screen.getByText(/Created on the floor by Kumar at .* — ready to confirm\./)).toBeInTheDocument();
    expect(screen.getByText("Free that shift: L2, L5.")).toBeInTheDocument();
  });

  it("confirmed: no button, and the free looms still shown", () => {
    plan = { ...base, status: "confirmed", floor: { completedAt: "2026-10-21T14:10:00.000Z", completedBy: "Kumar", freeMachines: [] } };
    open();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm plan/i })).not.toBeInTheDocument();
    expect(screen.getByText("No loom was free that shift.")).toBeInTheDocument();
  });

  it("shows what the floor entered as a draft to verify, and verifies it all in one go", async () => {
    plan = {
      ...base, totalProduction: 0, draftedProduction: 2460, pendingCount: 2, verifiedCount: 0,
      machines: [
        { id: "d1", machineId: "m1", machineName: "L1", jobOrderNo: 12, operatorName: "Ravi", production: 0, timer: "00:00:00", status: "pending_verification", headsRun: 2, draftProduction: 1640, submitted: { production: 820, timer: "7:30:00", feedback: "", at: "2026-10-21T13:40:00Z", byName: "Kumar" } },
        { id: "d2", machineId: "m2", machineName: "L2", jobOrderNo: 12, operatorName: "Sita", production: 0, timer: "00:00:00", status: "pending_verification", headsRun: 1, draftProduction: 820, submitted: { production: 820, timer: "7:00:00", feedback: "", at: "2026-10-21T13:45:00Z", byName: "Kumar" } },
        { id: "d3", machineId: "m3", machineName: "L3", jobOrderNo: 12, operatorName: "Anu", production: 0, timer: "00:00:00", status: "open" },
      ],
    };
    open();
    expect(screen.getByLabelText("To verify")).toHaveTextContent("2 entries entered, waiting to be verified — 2,460 m drafted.");
    expect(screen.getByText("Verified production").parentElement).toHaveTextContent("0 m+ 2,460 m drafted, to verify");
    expect(screen.getAllByText("Entered — to verify")).toHaveLength(2);
    expect(screen.getByText("820 /head × 2 · to verify")).toBeInTheDocument();
    expect(screen.getByText("Not entered")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^verify$/i })).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /verify all as entered/i }));
    await userEvent.click(screen.getByRole("button", { name: /^verify all$/i }));
    expect(verifyAsync).toHaveBeenCalledTimes(2);
    expect(verifyAsync).toHaveBeenNthCalledWith(1, { shiftId: "d1", productionMeters: 820, timer: "7:30:00" });
    expect(verifyAsync).toHaveBeenNthCalledWith(2, { shiftId: "d2", productionMeters: 820, timer: "7:00:00" });
    expect(toast).toHaveBeenCalledWith("2 entries verified — cascaded to job & order", "success");
  });

  it("an office plan has no floor panel", () => {
    plan = { ...base, source: "office", description: "Morning" };
    open();
    expect(screen.queryByText("Made from the floor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("From the floor")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm plan/i })).toBeInTheDocument();
  });
});
