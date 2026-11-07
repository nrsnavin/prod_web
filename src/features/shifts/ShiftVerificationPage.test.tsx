import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  // The night before on the same loom, entered on the floor and not verified yet.
  previous: {
    shift: { dateKey: "2026-10-03", shift: "NIGHT", label: "Night shift · 3 Oct 2026" },
    operator: "Sita", runTime: "7:45:00", verified: false, entryId: "sd-8",
    photo: { id: "ph1", takenAt: "2026-10-04T02:10:00Z", byName: "Night Sup", readText: "07:45:12", runTimeUsed: "7:45:00", used: true },
  },
} as PendingShift;

vi.mock("./hooks", () => ({
  usePendingVerification: () => ({ data: { shifts: [pending] }, isLoading: false, isError: false, error: null }),
  useShiftMutations: () => ({ verify: { mutate: verifyMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("./LoomSensors", () => ({ LoomSensors: () => null }));
vi.mock("./AutoVerify", () => ({ AutoVerifySettings: () => null, ShiftEndReminderSettings: () => null, ShiftHandoverSettings: () => null, AutoVerifiedList: () => null }));
const photos = vi.fn();
vi.mock("./TimerPhotos", () => ({
  TimerPhotos: (props: Record<string, unknown>) => {
    photos(props);
    return <p>timer-photos</p>;
  },
  // The photo bytes are fetched with the session; here there are none.
  usePhotoUrl: () => ({ url: null, isError: false }),
}));
const expected = vi.fn();
vi.mock("@/features/productionModel/ExpectedOutput", () => ({
  ExpectedOutput: (props: Record<string, unknown>) => {
    expected(props);
    return <p>expected-output</p>;
  },
}));

describe("verifying a shift", () => {
  it("shows what the loom's timer read the shift before, on the card and when verifying, even when that shift is not verified", async () => {
    render(<MemoryRouter><ShiftVerificationPage /></MemoryRouter>);
    // On the card: one line, with the figure and that it is still pending.
    const line = screen.getByLabelText("Timer the shift before");
    expect(line).toHaveTextContent("Shift before (Sita): timer 7:45:00 · not verified yet");

    await userEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    // On the verify screen: the block with the photo, beside this shift's own photos.
    const block = screen.getAllByLabelText("Timer the shift before").find((el) => el.tagName === "SECTION")!;
    expect(block).toHaveTextContent("Shift before · Night shift · 3 Oct 2026");
    expect(block).toHaveTextContent("Timer read 7:45:00 · Sita");
    expect(block).toHaveTextContent(/Not verified yet — the figure is as the floor submitted it/);
    expect(block).toHaveTextContent(/Photo by Night Sup at .* · used for the run time/);
    expect(within(block).getByRole("button", { name: /open the timer photo from the night shift/i })).toBeInTheDocument();
  });

  it("shows the remark's class on the card, and when it is one for the fitter", async () => {
    pending.remark = { kind: "mechanical", minutes: 60, machineFault: true, issue: null };
    pending.submittedFeedback = "motor noise, stopped 1 hr";
    render(<MemoryRouter><ShiftVerificationPage /></MemoryRouter>);
    expect(screen.getByLabelText("Remark")).toHaveTextContent("Mechanical fault · 1 h · for the fitter · “motor noise, stopped 1 hr”");
    delete pending.remark;
    delete pending.submittedFeedback;
  });

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
