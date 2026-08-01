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

// Shaped like the real /shift/today response: the server returns the
// lean ShiftPlan document, so `_id` is present alongside the explicit
// `id` the card reads. Feeding only `id` here is what let the missing
// field go unnoticed — the page passed while the browser saw nothing.
const summary = (production: number) => ({
  dayShift: {
    _id: "p1", id: "p1", shift: "DAY", status: "confirmed",
    production, machinesRunning: 2, operatorCount: 2, plan: [{}, {}],
  },
  nightShift: { id: null, shift: "NIGHT", status: "not_created", production: 0, plan: [] },
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

// ── The reported fault ───────────────────────────────────────────────
// A date with a plan showed "not created". The card decides a shift
// exists by reading `id`, and the server answered with a lean document
// carrying only `_id` — so the plan was fetched, counted and returned,
// and then rendered as nothing.
describe("a date that has a plan", () => {
  beforeEach(() => {
    days["2026-07-15"] = summary(1200);
  });

  it("shows the plan rather than 'not created'", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "By date" }));
    await user.clear(screen.getByLabelText("Date"));
    await user.type(screen.getByLabelText("Date"), "2026-07-15");

    expect(await screen.findByText("1,200")).toBeInTheDocument();
    expect(screen.getByText("planned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view plan/i })).toBeInTheDocument();
  });

  it("treats a summary with no id as nothing to show", () => {
    // Pins the contract the fix depends on: identity is what makes a
    // shift real to this page, so the server must always send it.
    days["today"] = {
      dayShift: { _id: "p1", shift: "DAY", status: "confirmed", production: 999, plan: [{}] },
      nightShift: { id: null, shift: "NIGHT", status: "not_created", production: 0, plan: [] },
    };
    renderPage();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
    expect(screen.getAllByText(/no plan yet for this shift/i)).toHaveLength(2);
  });
});
