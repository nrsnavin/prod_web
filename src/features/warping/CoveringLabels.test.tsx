import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
