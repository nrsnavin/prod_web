import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoveringLabels } from "./CoveringLabels";
import { Covering } from "./types";

const base: Covering = {
  _id: "c1",
  status: "in_progress",
  date: "2026-07-01T00:00:00.000Z",
  job: { _id: "j1", jobOrderNo: 8, customer: { name: "Acme" } },
  elasticPlanned: [{ elastic: { _id: "e1", name: "E-100" }, quantity: 500 }],
  beamEntries: [
    { _id: "b1", beamNo: 1, weight: 18, enteredAt: "2026-07-02T00:00:00.000Z", enteredBy: { name: "Ravi" } },
    { _id: "b2", beamNo: 2, weight: 22.5 },
  ],
  producedWeight: 40.5,
};

describe("CoveringLabels", () => {
  it("prints one label per beam entry showing weight in kg (not meters)", () => {
    render(<CoveringLabels open covering={base} onClose={() => {}} />);
    const text = document.body.textContent?.replace(/\s+/g, " ") ?? "";
    // Each beam's weight is rendered with a kg unit.
    expect(text).toContain("18 kg");
    expect(text).toContain("22.50 kg");
    // Weight unit is used, not the old meters label.
    expect(screen.getAllByText("kg").length).toBe(2);
    expect(screen.queryByText("m")).not.toBeInTheDocument();
    // Beam numbers are shown.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("prompts to add beams when none are recorded", () => {
    render(<CoveringLabels open covering={{ ...base, beamEntries: [] }} onClose={() => {}} />);
    expect(screen.getByText(/No beams recorded yet/i)).toBeInTheDocument();
  });

  it("gives each label its own Print button that solo-prints just that label", async () => {
    const { container } = render(<CoveringLabels open covering={base} onClose={() => {}} />);
    // Capture how many labels are the solo target at the moment print fires
    // (the class is cleared immediately afterwards).
    let soloAtPrint = -1;
    const printSpy = vi.fn(() => {
      soloAtPrint = container.querySelectorAll(".print-solo-target").length;
    });
    vi.stubGlobal("print", printSpy);
    const user = userEvent.setup();

    // One Print button per beam entry.
    expect(screen.getAllByRole("button", { name: /print beam \d+ label/i })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /print beam 2 label/i }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    // Exactly one label was targeted for the solo print.
    expect(soloAtPrint).toBe(1);
  });
});

afterEach(() => vi.unstubAllGlobals());
