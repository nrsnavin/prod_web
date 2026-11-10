import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProgressRail, settle } from "./ProgressRail";

// A rail says what is done, where the process stands and what waits;
// on a phone it folds into a bar with the step it stands at written out.

const steps = settle([
  { key: "a", label: "Generated", done: true, detail: "42 slips" },
  { key: "b", label: "Checked", done: false, detail: "2 slips to review" },
  { key: "c", label: "E-way bill", done: false, skipped: true, detail: "Not needed at this value" },
  { key: "d", label: "Paid", done: false },
]);

afterEach(() => vi.unstubAllGlobals());

describe("settling the states", () => {
  it("the first step neither done nor skipped is current; later ones wait", () => {
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "skipped", "todo"]);
  });

  it("a later step done out of order stays done", () => {
    const s = settle([
      { key: "a", label: "Bank", done: false },
      { key: "b", label: "Tally", done: true },
    ]);
    expect(s.map((x) => x.state)).toEqual(["current", "done"]);
  });

  it("all done leaves nothing current", () => {
    expect(settle([{ key: "a", label: "A", done: true }]).map((x) => x.state)).toEqual(["done"]);
  });
});

describe("on a wide screen", () => {
  it("lists every step, marks the current one, and says each state to a screen reader", () => {
    render(<ProgressRail label="Payroll · Nov 2026" steps={steps} />);
    const rail = screen.getByRole("region", { name: "Payroll · Nov 2026" });
    const items = within(rail).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent("Generated");
    expect(items[0]).toHaveTextContent("done");
    expect(items[0]).toHaveTextContent("42 slips");
    expect(items[2]).toHaveTextContent("skipped");
    expect(items[3]).toHaveTextContent("to do");
  });
});

describe("on a phone", () => {
  it("writes out the step it stands at, with its place in the whole", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("639px"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<ProgressRail label="Payroll · Nov 2026" steps={steps} />);
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByText("2 slips to review")).toBeInTheDocument();
    // Every step still reaches a screen reader.
    expect(screen.getByText("Paid: to do")).toBeInTheDocument();
  });

  it("says all done when nothing is left", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("639px"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<ProgressRail label="Count" steps={settle([{ key: "a", label: "Posted", done: true }])} />);
    expect(screen.getByText("All done")).toBeInTheDocument();
  });
});
