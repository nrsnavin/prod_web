import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ShiftPlansPage } from "./ShiftPlansPage";

const days: Record<string, unknown> = {};
const useShiftDay = vi.fn((dateIso?: string) => ({
  data: days[dateIso ?? "today"],
  isLoading: false,
}));

vi.mock("./hooks", () => ({
  useShiftDay: (d?: string) => useShiftDay(d),
  useShiftMutations: () => ({ createPlan: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const summary = (production: number) => ({
  dayShift: { shift: "DAY", id: "p1", status: "confirmed", production, machinesRunning: 2, operatorCount: 2 },
  nightShift: { shift: "NIGHT", status: "not_created", production: 0 },
});

const renderPage = () =>
  render(<MemoryRouter><ShiftPlansPage /></MemoryRouter>);

describe("ShiftPlansPage", () => {
  beforeEach(() => {
    useShiftDay.mockClear();
    for (const k of Object.keys(days)) delete days[k];
    days["today"] = summary(1250);
  });

  it("opens on Today and shows that day's metres", () => {
    renderPage();
    expect(screen.getByText("1,250")).toBeInTheDocument();
    // Today's view must not be filtered by the date picker.
    expect(useShiftDay).toHaveBeenCalledWith(undefined);
  });

  it("hides the date picker until the By date tab is chosen", async () => {
    renderPage();
    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /by date/i }));
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
  });

  it("shows the chosen date's plan, not today's", async () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    days[todayIso] = summary(1250);
    days["2026-03-01"] = summary(4400);

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /by date/i }));
    await userEvent.clear(screen.getByLabelText("Date"));
    await userEvent.type(screen.getByLabelText("Date"), "2026-03-01");

    expect(await screen.findByText("4,400")).toBeInTheDocument();
    expect(screen.queryByText("1,250")).not.toBeInTheDocument();
  });

  it("says so when a shift has no plan on that date", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /by date/i }));
    expect(screen.getAllByText(/no plan yet for this shift/i).length).toBeGreaterThan(0);
  });
});
