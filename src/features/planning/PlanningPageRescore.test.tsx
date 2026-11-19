import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanningPage } from "./PlanningPage";
import type { MachinePlan, PlanObjective, PlanRow, SuggestedPlan } from "./types";

// ══════════════════════════════════════════════════════════════════
//  AN EDITED PLAN SHOWS WHAT IT COMES TO, BEFORE IT IS ACCEPTED
//
//  A line could be moved to another loom or up and down a loom's queue,
//  and nothing on the screen followed it: the moved row kept the dates
//  of the place it had left, the tiles kept the proposal's count of late
//  lines, and the "accept" dialog quoted the proposal — "every placed
//  line meets its supply date" — for a plan that no longer was the
//  proposal. The server now scores an arrangement the way accepting it
//  will (POST /planner/score); the page asks after every move.
// ══════════════════════════════════════════════════════════════════

const row = (over: Partial<PlanRow>): PlanRow => ({
  lineId: "o1:e1", orderId: "o1", orderNo: 101, customer: "Acme", elasticId: "e1", elasticName: "20mm Black",
  qtyMeters: 6000, heads: 4, sequence: 0, weavingDays: 3, startWorkingDay: 0,
  projectedFinish: "2026-11-23", dueDate: "2026-11-24", late: false, lateWorkingDays: 0,
  changeover: false, rateSource: "coldstart", ...over,
});
const urgent = row({});
const relaxed = row({ lineId: "o2:e1", orderId: "o2", orderNo: 102, elasticName: "20mm White", sequence: 1, startWorkingDay: 3, projectedFinish: "2026-11-26", dueDate: "2026-12-30" });
const loom: MachinePlan = { machineId: "m1", machineID: "LOOM-01", heads: 4, changeovers: 0, rows: [urgent, relaxed] };
const objective: PlanObjective = { lines: 2, placed: 2, unplaceable: 0, beyondHorizon: 0, onTime: 2, late: 0, totalLateDays: 0, changeovers: 0, machinesUsed: 1 };
const plan = {
  success: true, generatedAt: "2026-11-19T00:00:00.000Z", horizonDays: 7, horizonEnd: "2026-11-27",
  objective, committed: [], machines: [loom], unplaceable: [], assumptions: [], aiRationale: null, aiGenerated: false,
  weights: { late: 10, changeover: 1, balance: 1 }, objectiveTerms: { late: 0, changeover: 0, balance: 0 },
} as unknown as SuggestedPlan;

// The same loom with the urgent line pushed behind the other, as the server scores it.
const swapped: MachinePlan = {
  ...loom,
  rows: [
    { ...relaxed, sequence: 0, startWorkingDay: 0, projectedFinish: "2026-11-23" },
    { ...urgent, sequence: 1, startWorkingDay: 3, projectedFinish: "2026-11-26", late: true, lateWorkingDays: 2 },
  ],
};
const swappedObjective: PlanObjective = { ...objective, onTime: 1, late: 1, totalLateDays: 2 };

const score = vi.fn();
const acceptMutate = vi.fn();
vi.mock("./api", () => ({ plannerService: { score: (...a: unknown[]) => score(...a) } }));
vi.mock("./hooks", () => ({
  useSuggestedPlan: () => ({ data: plan, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() }),
  useLatestPlan: () => ({ data: { plan: null }, refetch: vi.fn() }),
  useAcceptPlan: () => ({ mutate: acceptMutate, isPending: false }),
}));
vi.mock("./AcceptedPlanPanel", () => ({ AcceptedPlanPanel: () => null }));
vi.mock("./LearnedWeightsPanel", () => ({ LearnedWeightsPanel: () => null }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeEach(() => { score.mockReset(); acceptMutate.mockReset(); });

const moveUrgentLater = async (u: ReturnType<typeof userEvent.setup>) =>
  u.click(screen.getByRole("button", { name: "Move 20mm Black later" }));

describe("moving a line on the plan", () => {
  it("asks the server what the new arrangement comes to, and shows it", async () => {
    score.mockResolvedValue({ success: true, machines: [swapped], objective: swappedObjective, gone: [] });
    const u = userEvent.setup();
    render(<PlanningPage />);
    expect(screen.queryByText("Late 2d")).not.toBeInTheDocument();

    await moveUrgentLater(u);

    // Asked with the rows in the order they were left.
    expect(score).toHaveBeenCalledTimes(1);
    const [horizon, machines] = score.mock.calls[0];
    expect(horizon).toBe(7);
    expect((machines as MachinePlan[])[0].rows.map((r) => r.orderNo)).toEqual([102, 101]);

    // Before: the row kept "On time", and the tile kept "Late 0".
    expect(await screen.findByText("Late 2d")).toBeInTheDocument();
    expect(screen.getByText("2 late-days total")).toBeInTheDocument();
    expect(screen.queryByText("all orders hit their supply date")).not.toBeInTheDocument();
  });

  it("the accept dialog speaks of the plan being accepted, not the one proposed", async () => {
    score.mockResolvedValue({ success: true, machines: [swapped], objective: swappedObjective, gone: [] });
    const u = userEvent.setup();
    render(<PlanningPage />);
    await moveUrgentLater(u);
    await screen.findByText("Late 2d");

    await u.click(screen.getByRole("button", { name: /Accept my version/ }));
    const dialog = screen.getByRole("dialog");
    // Before: "Every placed line meets its supply date." — true of the proposal.
    expect(within(dialog).getByText(/1 line finishes late: 2 late-days in all/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Every placed line meets its supply date/)).not.toBeInTheDocument();
  });

  it("says so, and still lets the plan be accepted, when it cannot be scored", async () => {
    score.mockImplementation(() => Promise.reject(new Error("Not found")));     // an older server
    const u = userEvent.setup();
    render(<PlanningPage />);
    await moveUrgentLater(u);

    // The proposal's "all on time" is not said of a plan that has not been scored.
    expect(await screen.findByText(/your version's dates are being worked out/)).toBeInTheDocument();
    expect(screen.queryByText("all orders hit their supply date")).not.toBeInTheDocument();

    await u.click(await screen.findByRole("button", { name: /Accept my version/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/worked out again when it is accepted/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Every placed line meets its supply date/)).not.toBeInTheDocument();
  });

  it("undoing the changes goes back to the proposal's figures", async () => {
    score.mockResolvedValue({ success: true, machines: [swapped], objective: swappedObjective, gone: [] });
    const u = userEvent.setup();
    render(<PlanningPage />);
    await moveUrgentLater(u);
    await screen.findByText("Late 2d");

    await u.click(screen.getByRole("button", { name: "Undo my changes" }));
    expect(screen.queryByText("Late 2d")).not.toBeInTheDocument();
    expect(screen.getByText("all orders hit their supply date")).toBeInTheDocument();
  });

  it("an answer to an earlier move does not overwrite a later one", async () => {
    let first: (v: unknown) => void = () => {};
    score.mockImplementationOnce(() => new Promise((resolve) => { first = resolve; }));
    score.mockResolvedValueOnce({ success: true, machines: [loom], objective, gone: [] });
    const u = userEvent.setup();
    render(<PlanningPage />);

    await moveUrgentLater(u);                                                     // asked, not yet answered
    await u.click(screen.getByRole("button", { name: "Move 20mm Black earlier" })); // moved back: asked again
    expect(score).toHaveBeenCalledTimes(2);
    // The first answer arrives last.
    first({ success: true, machines: [swapped], objective: swappedObjective, gone: [] });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Late 2d")).not.toBeInTheDocument();
  });
});
