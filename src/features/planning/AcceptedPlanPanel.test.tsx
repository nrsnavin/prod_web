import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcceptedPlanPanel } from "./AcceptedPlanPanel";
import type { AcceptedPlan } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE PLAN THE FLOOR IS SUPPOSED TO BE FOLLOWING
//
//  This replaced a banner reading "Plan of record accepted <date> by
//  <who> · 14 assignments" — every word about the acceptance and none
//  about the plan. The schedule itself could not be read anywhere in
//  the application.
//
//  So the tests are about whether somebody standing at a loom can
//  answer "what runs next on this one, and when does it finish", and
//  about the one fact that is easy to lose: whether a human overruled
//  the planner before accepting.
// ══════════════════════════════════════════════════════════════════

const row = (over: Partial<AcceptedPlan["assignments"][number]> = {}) => ({
  machineID: "LOOM-01", elasticName: "20mm White", orderNo: 41,
  customer: "Anand", qtyMeters: 1200, sequence: 0, weavingDays: 3,
  startWorkingDay: 0, heads: 4,
  projectedFinish: "2026-08-24", dueDate: "2026-08-28",
  late: false, lateWorkingDays: 0, changeover: false,
  rateSource: "posterior" as const,
  ...over,
});

const plan = (over: Partial<AcceptedPlan> = {}): AcceptedPlan => ({
  _id: "p1", horizonDays: 7,
  generatedAt: "2026-08-18T09:00:00Z",
  acceptedAt: "2026-08-18T10:00:00Z",
  acceptedBy: "Navin",
  objective: {
    lines: 2, placed: 2, unplaceable: 0, beyondHorizon: 0,
    onTime: 2, late: 0, totalLateDays: 0, changeovers: 0, machinesUsed: 1,
  },
  edited: false,
  assignments: [row()],
  assumptions: [],
  status: "accepted",
  ...over,
});

const open = async () =>
  userEvent.click(screen.getByRole("button", { name: /plan of record accepted/i }));

describe("AcceptedPlanPanel", () => {
  it("summarises without being opened", () => {
    render(<AcceptedPlanPanel plan={plan({
      assignments: [row(), row({ machineID: "LOOM-02", elasticName: "25mm" })],
    })} />);
    expect(screen.getByText(/Navin/)).toBeInTheDocument();
    expect(screen.getByText(/2 runs on 2 machines/i)).toBeInTheDocument();
  });

  it("shows the queue for each loom, in running order", async () => {
    // The question somebody at a machine is actually asking.
    render(<AcceptedPlanPanel plan={plan({
      assignments: [
        row({ elasticName: "Second", sequence: 1 }),
        row({ elasticName: "First", sequence: 0 }),
      ],
    })} />);
    await open();

    const table = screen.getByRole("table");
    const cells = within(table).getAllByRole("row").slice(1)
      .map((tr) => within(tr).getAllByRole("cell")[1].textContent);
    expect(cells).toEqual(["First", "Second"]);
  });

  it("groups by machine rather than listing assignments flat", async () => {
    render(<AcceptedPlanPanel plan={plan({
      assignments: [row(), row({ machineID: "LOOM-07" })],
    })} />);
    await open();
    expect(screen.getByText(/LOOM-01/)).toBeInTheDocument();
    expect(screen.getByText(/LOOM-07/)).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
  });

  it("marks a late run with how late it is", async () => {
    render(<AcceptedPlanPanel plan={plan({
      assignments: [row({ late: true, lateWorkingDays: 4 })],
    })} />);
    expect(screen.getByText(/1 late/)).toBeInTheDocument();
    await open();
    expect(screen.getByText("4d late")).toBeInTheDocument();
  });

  it("says when a human changed the plan before accepting it", async () => {
    // The most informative fact on the screen, and the one that used to
    // be discarded the moment the plan was saved.
    render(<AcceptedPlanPanel plan={plan({
      edited: true,
      proposedTerms: { late: 1, changeover: 0, balance: 2 },
      objectiveTerms: { late: 2, changeover: 1, balance: 0 },
    })} />);

    expect(screen.getByText(/edited before accepting/i)).toBeInTheDocument();
    await open();
    expect(screen.getByText(/Planner offered/i)).toBeInTheDocument();
    expect(screen.getByText(/1d late · 0 changeovers · 2.0 imbalance/)).toBeInTheDocument();
    expect(screen.getByText(/2d late · 1 changeover · 0.0 imbalance/)).toBeInTheDocument();
  });

  it("says nothing about an edit when there was none", async () => {
    render(<AcceptedPlanPanel plan={plan()} />);
    expect(screen.queryByText(/edited before accepting/i)).not.toBeInTheDocument();
    await open();
    expect(screen.queryByText(/Planner offered/i)).not.toBeInTheDocument();
  });

  it("flags a changeover on the run that carries it", async () => {
    render(<AcceptedPlanPanel plan={plan({
      assignments: [row(), row({ elasticName: "25mm", changeover: true, sequence: 1 })],
    })} />);
    await open();
    expect(screen.getByText(/\(changeover\)/)).toBeInTheDocument();
  });
});
