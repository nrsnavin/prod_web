import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OrderExcessPlanning } from "./OrderExcessPlanning";
import type { ExcessPlanningRow } from "./types";

// The card exists to answer one question a planner asks weeks later:
// why did this order draw more yarn than its own lines called for?
// So the two things it must never do are hide an excess, and leave a
// blank where a reason should be — a blank reads as "withheld" when it
// usually means "inside the allowance, nobody was asked".

const row = (over: Partial<ExcessPlanningRow> = {}): ExcessPlanningRow => ({
  elastic: "e1",
  name: "Woven Elastic 25mm",
  job: "j1",
  jobOrderNo: 42,
  jobNo: "J-42",
  orderedQuantity: 1000,
  plannedQuantity: 1150,
  excessQuantity: 150,
  excessPct: 15,
  reason: "",
  materialsDrawn: [{ rawMaterial: "m1", name: "Nylon 70D", quantity: 12.5 }],
  recordedAt: null,
  ...over,
});

describe("the excess planning card", () => {
  // A section headed "Excess planning — none" on every order teaches
  // people to stop reading it.
  it("is absent entirely when nothing was over-planned", () => {
    const { container } = render(<OrderExcessPlanning rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the elastic, the job, and the quantities", () => {
    render(<OrderExcessPlanning rows={[row()]} />);
    expect(screen.getByText("Woven Elastic 25mm")).toBeInTheDocument();
    expect(screen.getByText("J-42")).toBeInTheDocument();
    expect(screen.getByText("1,000 m")).toBeInTheDocument();
    expect(screen.getByText("1,150 m")).toBeInTheDocument();
    expect(screen.getByText("+150 m")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("shows the reason against the line it explains", () => {
    render(<OrderExcessPlanning rows={[row({
      excessQuantity: 500, excessPct: 50, plannedQuantity: 1500,
      reason: "Loom set for a full beam; the customer takes the overrun.",
    })]} />);
    expect(screen.getByText(/Loom set for a full beam/)).toBeInTheDocument();
  });

  it("says why there is no reason, rather than leaving a blank", () => {
    render(<OrderExcessPlanning rows={[row()]} />);
    expect(screen.getByText(/Within the 20% allowance — no reason required/))
      .toBeInTheDocument();
  });

  it("lists the yarn the excess drew from stock", () => {
    render(<OrderExcessPlanning rows={[row()]} />);
    expect(screen.getByText(/Nylon 70D 12.5 kg/)).toBeInTheDocument();
  });

  it("summarises the total over-planned and how many lines needed a reason", () => {
    render(<OrderExcessPlanning rows={[
      row(),
      row({ elastic: "e2", name: "Woven Elastic 50mm", job: "j2", jobNo: "J-43",
        excessQuantity: 500, excessPct: 50, reason: "Customer raised the quantity late." }),
    ]} />);
    const header = screen.getByText(/planned over what this order asked for/);
    expect(header.textContent).toMatch(/650 m/);
    expect(header.textContent).toMatch(/1 line past the 20% allowance/);
  });

  // Two jobs can each over-plan the same elastic. Showing one would
  // hide a decision someone made and had to justify.
  it("shows every excess, including two against the same elastic", () => {
    render(<OrderExcessPlanning rows={[
      row({ jobNo: "J-42", reason: "" }),
      row({ job: "j2", jobNo: "J-43", excessPct: 40, excessQuantity: 400,
        reason: "Second beam added after a quantity revision." }),
    ]} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("J-42")).toBeInTheDocument();
    expect(within(table).getByText("J-43")).toBeInTheDocument();
    expect(within(table).getByText(/Second beam added/)).toBeInTheDocument();
  });
});
