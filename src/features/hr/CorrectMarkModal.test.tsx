import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  CorrectMarkModal,
  correctionOf,
  formOf,
  problemWith,
  stampLabel,
  timerSummary,
} from "./CorrectMarkModal";
import type { AttendanceRecord } from "./api";

// ══════════════════════════════════════════════════════════════════
//  Putting one mark right. The page could only mark the unmarked: a
//  shift whose clock-out was forgotten had no screen to be corrected on.
//  Held here: only what is changed is sent (the server leaves the rest),
//  and hours go as minutes for a timed shift, as times for a typed one.
// ══════════════════════════════════════════════════════════════════

const correct = vi.fn();
const toast = vi.fn();

vi.mock("./api", () => ({
  attendanceService: { correct: (id: string, body: unknown) => correct(id, body) },
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString();

/** Clocked in on the 3rd at 08:02, clocked out on the 6th: a clock-out forgotten. */
const forgotten: AttendanceRecord = {
  id: "a1", name: "Ravi Kumar", shift: "DAY", status: "present", dateLabel: "03 Nov 2026",
  checkIn: "", checkOut: "", clockInAt: at(3, 8, 2), clockOutAt: at(6, 9, 15),
  workedMinutes: 4393, priorMinutes: 0, lateMinutes: 0, overtimeMinutes: 0, leaveType: "", notes: "", markedBy: "Asha",
};
/** Marked by hand, with times typed in. */
const typed: AttendanceRecord = {
  id: "a2", name: "Priya S", shift: "DAY", status: "late", checkIn: "08:40", checkOut: "20:00",
  clockInAt: null, clockOutAt: null, workedMinutes: 680, lateMinutes: 40, overtimeMinutes: 0, leaveType: "", notes: "bus",
};

function open(record: AttendanceRecord, onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CorrectMarkModal record={record} onClose={onClose} />
    </QueryClientProvider>
  );
  return onClose;
}

beforeEach(() => {
  correct.mockReset().mockResolvedValue({ success: true, changed: true, payslipFinal: false, data: {} });
  toast.mockReset();
});

describe("what is sent", () => {
  it("is nothing when nothing was changed", () => {
    expect(correctionOf(forgotten, formOf(forgotten))).toEqual({});
    expect(correctionOf(typed, formOf(typed))).toEqual({});
  });

  it("is the hours as minutes for a shift on the timer, and never typed times", () => {
    const form = { ...formOf(forgotten), hours: "10", minutes: "30", checkIn: "08:00", checkOut: "18:30" };
    expect(correctionOf(forgotten, form)).toEqual({ workedMinutes: 630 });
  });

  it("is the times for a shift marked by hand — cleared, they are sent as cleared", () => {
    expect(correctionOf(typed, { ...formOf(typed), checkOut: "18:00" })).toEqual({ checkOut: "18:00" });
    expect(correctionOf(typed, { ...formOf(typed), checkIn: "", checkOut: "" })).toEqual({ checkIn: "", checkOut: "" });
  });

  it("is the status alone when the shift stops being a worked one", () => {
    const form = { ...formOf(typed), status: "absent", checkOut: "18:00", late: "5" };
    expect(correctionOf(typed, form)).toEqual({ status: "absent" });
  });

  it("carries late and overtime minutes, the leave type and the note when they change", () => {
    expect(correctionOf(typed, { ...formOf(typed), late: "", overtime: "45", notes: " bus was late " }))
      .toEqual({ lateMinutes: 0, overtimeMinutes: 45, notes: "bus was late" });
    expect(correctionOf(typed, { ...formOf(typed), status: "on_leave", leaveType: "sick" }))
      .toEqual({ status: "on_leave", leaveType: "sick" });
  });

  it("leaves a timer still running without a figure until one is typed", () => {
    const running = { ...forgotten, clockOutAt: null, workedMinutes: 0 };
    expect(formOf(running)).toMatchObject({ hours: "", minutes: "" });
    expect(correctionOf(running, formOf(running))).toEqual({});
    expect(correctionOf(running, { ...formOf(running), hours: "8" })).toEqual({ workedMinutes: 480 });
  });
});

describe("what is refused before it is sent", () => {
  it("one time without the other, on a shift marked by hand", () => {
    expect(problemWith({ ...formOf(typed), checkOut: "" }, false)).toMatch(/both the In and the Out/);
    expect(problemWith({ ...formOf(typed), checkIn: "", checkOut: "" }, false)).toBeNull();
  });

  it("hours that are not hours", () => {
    expect(problemWith({ ...formOf(forgotten), hours: "25", minutes: "0" }, true)).toMatch(/longer than a day/);
    expect(problemWith({ ...formOf(forgotten), hours: "9", minutes: "75" }, true)).toMatch(/up to 59/);
    expect(problemWith({ ...formOf(forgotten), hours: "-1" }, true)).toMatch(/whole number/);
    expect(problemWith({ ...formOf(forgotten), hours: "9.5" }, true)).toMatch(/whole number/);
    expect(problemWith({ ...formOf(forgotten), hours: "10", minutes: "30" }, true)).toBeNull();
  });
});

describe("what the timer has, in words", () => {
  it("shows the date once the clock-out is on another day", () => {
    expect(stampLabel(at(3, 20, 5), at(3, 8, 2))).toBe("20:05");
    expect(stampLabel(at(6, 9, 15), at(3, 8, 2))).toBe("6 Nov, 09:15");
    expect(stampLabel(null, at(3, 8, 2))).toBe("");
  });

  it("says when nobody clocked out", () => {
    expect(timerSummary({ ...forgotten, clockOutAt: null })).toBe("Clocked in 3 Nov 2026, 08:02 and never clocked out.");
    expect(timerSummary(forgotten)).toBe("Clocked in 3 Nov 2026, 08:02 — clocked out 6 Nov, 09:15.");
    expect(timerSummary(typed)).toBe("");
  });
});

describe("the dialog", () => {
  it("a clock-out forgotten: says so, and sends the hours actually worked", async () => {
    const user = userEvent.setup();
    const onClose = open(forgotten);
    expect(screen.getByText(/longer than a shift: enter the hours actually worked/i)).toBeInTheDocument();
    // No typed times on a shift the timer recorded.
    expect(screen.queryByLabelText("In")).not.toBeInTheDocument();

    const hours = screen.getByLabelText("Hours worked");
    await user.clear(hours);
    await user.type(hours, "10");
    const minutes = screen.getByLabelText("Minutes");
    await user.clear(minutes);
    await user.click(screen.getByRole("button", { name: /save correction/i }));

    expect(correct).toHaveBeenCalledWith("a1", { workedMinutes: 600 });
    expect(await screen.findByRole("button", { name: /save correction/i })).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("Attendance corrected", "success");
    expect(onClose).toHaveBeenCalled();
  });

  it("says when the month's payslip was already finalised", async () => {
    correct.mockResolvedValue({ success: true, changed: true, payslipFinal: true, data: {} });
    const user = userEvent.setup();
    open(typed);
    await user.selectOptions(screen.getByLabelText("Status"), "absent");
    await user.click(screen.getByRole("button", { name: /save correction/i }));

    expect(correct).toHaveBeenCalledWith("a2", { status: "absent" });
    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.stringMatching(/payslip is already finalised/), "info")
    );
  });

  it("saved with nothing changed, it closes and sends nothing", async () => {
    const user = userEvent.setup();
    const onClose = open(typed);
    await user.click(screen.getByRole("button", { name: /save correction/i }));
    expect(correct).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("a shift that is not a worked one has no hours to give", async () => {
    const user = userEvent.setup();
    open(typed);
    expect(screen.getByLabelText("In")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "on_leave");
    expect(screen.queryByLabelText("In")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Leave type")).toBeInTheDocument();
  });
});
