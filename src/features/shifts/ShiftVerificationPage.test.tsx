import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ShiftVerificationPage } from "./ShiftVerificationPage";
import type { PendingShift } from "./types";

// Verifying a worker's entry: the figure is per head, as it was entered,
// and what the loom should have made is shown beside it.

const verifyMutate = vi.fn();
const pending: PendingShift = {
  _id: "sd-9",
  status: "pending_verification",
  submittedProductionMeters: 356,
  submittedTimer: "7:30:00",
  employee: { _id: "e1", name: "Ravi" },
  machine: { _id: "m2", ID: "LOOM-02" },
  shiftPlan: { date: "2026-10-04T00:00:00.000Z", shift: "DAY" },
} as PendingShift;

vi.mock("./hooks", () => ({
  usePendingVerification: () => ({ data: { shifts: [pending] }, isLoading: false, isError: false, error: null }),
  useShiftMutations: () => ({ verify: { mutate: verifyMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const photos = vi.fn();
vi.mock("./TimerPhotos", () => ({
  TimerPhotos: (props: Record<string, unknown>) => {
    photos(props);
    return <p>timer-photos</p>;
  },
}));
const expected = vi.fn();
vi.mock("@/features/productionModel/ExpectedOutput", () => ({
  ExpectedOutput: (props: Record<string, unknown>) => {
    expected(props);
    return <p>expected-output</p>;
  },
}));

describe("verifying a shift", () => {
  it("asks for the figure per head and shows what to expect beside it", async () => {
    render(<MemoryRouter><ShiftVerificationPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(screen.getByText(/Submitted: 356 m per head · 7:30:00/)).toBeInTheDocument();
    expect(screen.getByLabelText("Verified production per head (m) *")).toHaveValue(356);
    expect(screen.getByText("expected-output")).toBeInTheDocument();
    expect(expected).toHaveBeenLastCalledWith({ shiftId: "sd-9", runTime: "7:30:00", entered: "356" });
    // The photos of the timer, to check the run time against.
    expect(screen.getByText("timer-photos")).toBeInTheDocument();
    expect(photos).toHaveBeenLastCalledWith({ shiftId: "sd-9" });
  });
});
