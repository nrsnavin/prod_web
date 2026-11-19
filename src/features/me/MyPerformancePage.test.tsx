import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MyPerformancePage } from "./MyPerformancePage";
import type { MyPerformance, MyShiftHistoryRow } from "./types";

// A worker's own figures. The server lists the newest 200 shift rows and
// adds up the whole period (a row is one loom for one shift; four looms
// fill 200 rows in under two months). The page said "24,000 m over 240
// shifts" above a list that stopped at 200 with nothing to say why.

const perf = vi.fn();
vi.mock("./hooks", () => ({
  useMyPerformance: () => perf(),
  useMyWastage: () => ({ data: [], isLoading: false, error: null }),
}));

const rows = (n: number): MyShiftHistoryRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`, date: new Date(Date.UTC(2026, 10, 18) - Math.floor(i / 4) * 86_400_000).toISOString(), shift: "DAY",
    machine: `LOOM-${(i % 4) + 1}`, elastics: ["20mm trouser"], metres: 100, runHours: 8, metresPerHour: 12.5,
  }));
const answer = (shifts: number, listed: number): { data: MyPerformance; isLoading: boolean; error: null } => ({
  isLoading: false, error: null,
  data: {
    days: 90,
    summary: { shifts, listed, totalMetres: shifts * 100, avgPerShift: 100, metresPerHour: 12.5, plantAvgPerShift: 90, previousAvgPerShift: 80, changePct: 25 },
    shifts: rows(listed),
  },
});
const wrap = () => render(<MemoryRouter><MyPerformancePage /></MemoryRouter>);
const showAll = async () => {
  for (;;) {
    const more = screen.queryByRole("button", { name: /Show more/ });
    if (!more) return;
    await userEvent.click(more);
  }
};

beforeEach(() => perf.mockReset());

describe("my performance", () => {
  it("says the list is the newest part of the period, once all of it is on the page", async () => {
    perf.mockReturnValue(answer(240, 200));
    wrap();
    expect(await screen.findByText("24,000 m over 240 shifts")).toBeInTheDocument();
    // Not while there is more of the list to show.
    expect(screen.queryByText(/newest 200 of 240/)).not.toBeInTheDocument();
    await showAll();
    expect(screen.getByText("These are the newest 200 of 240 shifts in this period. The figures above count all 240.")).toBeInTheDocument();
  });

  it("says nothing of the kind when every shift is listed (unchanged)", async () => {
    perf.mockReturnValue(answer(12, 12));
    wrap();
    expect(await screen.findByText("1,200 m over 12 shifts")).toBeInTheDocument();
    await showAll();
    expect(screen.queryByText(/newest/)).not.toBeInTheDocument();
  });
});
