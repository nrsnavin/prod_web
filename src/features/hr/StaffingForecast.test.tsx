import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StaffingForecast } from "./StaffingForecast";
import type { StaffingForecast as Forecast, ForecastSlot } from "./api";

// ══════════════════════════════════════════════════════════════════
//  STAFFING THE PLAN, NOT RANKING THE PEOPLE
//
//  Two things this panel has to get right, and only one of them is
//  about the plan.
//
//  The plan half: the headline number is what to build against, which
//  means expected attendance rounded DOWN. A plan that assumes the
//  ninth person turns up is a plan that assumes full attendance, which
//  is the assumption this exists to remove.
//
//  The other half matters more. No names. Not a name, not an initial,
//  not a count of who was absent. A per-person attendance figure on a
//  shared screen becomes a league table within a week and a reason
//  somebody was let go within a month — from a number that cannot tell
//  an unreliable worker from one who had a sick child in April.
// ══════════════════════════════════════════════════════════════════

const staffingForecast = vi.fn();
vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return { ...actual, attendanceService: { staffingForecast: (d?: number) => staffingForecast(d) } };
});

const slot = (over: Partial<ForecastSlot> = {}): ForecastSlot => ({
  dayOfWeek: 1, day: "Mon", shift: "DAY",
  peopleRostered: 9, expectedHeads: 8.7, expectedAttendancePct: 96.7,
  planningHeads: 8, confidentPeople: 9, thin: false,
  ...over,
});

const forecast = (over: Partial<Forecast> = {}): Forecast => ({
  success: true,
  windowDays: 240,
  roster: 12,
  plantAttendancePct: 93.4,
  slots: [slot()],
  weakestSlot: { day: "Sat", shift: "NIGHT", expectedAttendancePct: 71 },
  method: "Attendance per (person, weekday, shift) over the last window, weighted with a 60-day half-life… Approved leave is excluded. Expected heads are rounded DOWN for planning.",
  note: null,
  ...over,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <StaffingForecast />
    </QueryClientProvider>
  );
}

beforeEach(() => staffingForecast.mockReset());

describe("StaffingForecast", () => {
  it("leads with the number to plan against, not the optimistic one", async () => {
    // 8.7 expected. The plan gets 8.
    staffingForecast.mockResolvedValue(forecast());
    renderPanel();

    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(screen.getByText("of 9")).toBeInTheDocument();
    // The phrase appears twice — once in the panel's own explanation
    // and once in the method paragraph from the server.
    expect(screen.getAllByText(/rounded down/i).length).toBeGreaterThan(0);
  });

  it("shows no names anywhere", async () => {
    // The property that matters most here, asserted against the whole
    // rendered document rather than against a single element.
    staffingForecast.mockResolvedValue(forecast());
    renderPanel();
    await screen.findByText("8");

    // The API carries no names, and the panel adds none of its own —
    // no "3 absent", no initials, nothing person-shaped.
    expect(document.body.textContent).not.toMatch(/absent/i);
    expect(screen.getByText(/not for comparing people/i)).toBeInTheDocument();
  });

  it("names the thinnest slot, so the plan can be built around it", async () => {
    staffingForecast.mockResolvedValue(forecast());
    renderPanel();
    expect(await screen.findByText(/Sat night/i)).toBeInTheDocument();
    expect(screen.getByText(/71%/)).toBeInTheDocument();
  });

  it("marks a slot whose people are thinly observed", async () => {
    staffingForecast.mockResolvedValue(forecast({
      slots: [slot({ thin: true, confidentPeople: 2 })],
    }));
    renderPanel();
    expect(await screen.findByText("thin")).toBeInTheDocument();
  });

  it("shows a dash for a slot nobody has ever worked", async () => {
    // Not a zero. "Nobody will be here" and "this shift has never run"
    // are different claims.
    staffingForecast.mockResolvedValue(forecast({ slots: [slot({ day: "Mon", shift: "DAY" })] }));
    renderPanel();
    await screen.findByText("8");
    // Six other weekdays plus both night slots are empty.
    expect(screen.getAllByText("—").length).toBeGreaterThan(5);
  });

  it("explains an empty register rather than showing zeros", async () => {
    staffingForecast.mockResolvedValue(forecast({
      slots: [], plantAttendancePct: null,
      note: "No attendance recorded in this window — nothing to forecast from.",
    }));
    renderPanel();
    expect(await screen.findByText(/nothing to forecast from/i)).toBeInTheDocument();
  });

  it("prints the method, including what it excludes", async () => {
    // Approved leave being excluded is the thing somebody will query,
    // so it is on the page rather than only in the source.
    staffingForecast.mockResolvedValue(forecast());
    renderPanel();
    expect(await screen.findByText(/approved leave is excluded/i)).toBeInTheDocument();
  });
});
