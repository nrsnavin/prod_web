import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CoveringProgrammeSheet, beamSheetRows } from "./CoveringProgrammeSheet";
import type { BeamEntry, Covering } from "./types";

// The programme is printed BEFORE the beams exist, so the sheet has to
// carry blank rows the operator writes into at the machine. Once weights
// are entered on the covering page the same rows print filled — the sheet
// is then a record rather than a form, and reprinting it must not lose
// anything already recorded.

const beam = (over: Partial<BeamEntry> = {}): BeamEntry => ({
  _id: `b${over.beamNo ?? 1}`,
  beamNo: 1,
  weight: 18,
  ...over,
});

const covering = (over: Partial<Covering> = {}): Covering => ({
  _id: "c1",
  status: "in_progress",
  date: "2026-07-01T00:00:00.000Z",
  job: { _id: "j1", jobOrderNo: 8, customer: { name: "Acme" } },
  elasticPlanned: [{ elastic: { _id: "e1", name: "E-100" }, quantity: 500 }],
  beamEntries: [],
  ...over,
});

/** The beam-weight tables are the two that carry a Beam # column. */
const beamTables = () =>
  screen
    .getAllByRole("table")
    .filter((t) => within(t).queryByText("Beam #") !== null);

const beamBodyRows = () =>
  beamTables().flatMap((t) => Array.from(t.querySelectorAll("tbody tr")));

describe("the beam weight grid", () => {
  it("prints 20 rows even when no beam has been entered yet", () => {
    render(<CoveringProgrammeSheet open onClose={() => {}} covering={covering()} />);
    expect(beamBodyRows()).toHaveLength(20);
    expect(screen.getByText(/to be entered at the machine/i)).toBeInTheDocument();
  });

  it("numbers the rows 1 to 20 across the two halves", () => {
    render(<CoveringProgrammeSheet open onClose={() => {}} covering={covering()} />);
    const serials = beamBodyRows().map((r) => r.querySelector("td")?.textContent);
    expect(serials).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
  });

  it("leaves the beam number and weight blank on an unfilled row", () => {
    render(<CoveringProgrammeSheet open onClose={() => {}} covering={covering()} />);
    const cells = Array.from(beamBodyRows()[0].querySelectorAll("td"));
    expect(cells[0]).toHaveTextContent("1");   // serial, pre-printed
    expect(cells[1]).toHaveTextContent("");    // beam #, for the operator
    expect(cells[2]).toHaveTextContent("");    // weight, for the operator
  });

  it("fills the rows from what was entered on the covering page", () => {
    render(
      <CoveringProgrammeSheet
        open
        onClose={() => {}}
        covering={covering({
          beamEntries: [
            beam({ beamNo: 1, weight: 18 }),
            beam({ beamNo: 2, weight: 22.5, note: "shade B" }),
          ],
          producedWeight: 40.5,
        })}
      />
    );
    const rows = beamBodyRows();
    expect(Array.from(rows[0].querySelectorAll("td")).map((c) => c.textContent))
      .toEqual(["1", "1", "18", ""]);
    expect(Array.from(rows[1].querySelectorAll("td")).map((c) => c.textContent))
      .toEqual(["2", "2", "22.50", "shade B"]);
    // Everything after what was entered stays blank.
    expect(Array.from(rows[2].querySelectorAll("td")).map((c) => c.textContent))
      .toEqual(["3", "", "", ""]);
    expect(screen.getByText("40.50 kg")).toBeInTheDocument();
  });

  it("rules a blank total when nothing has been weighed", () => {
    render(<CoveringProgrammeSheet open onClose={() => {}} covering={covering()} />);
    expect(screen.getByText(/____________ kg/)).toBeInTheDocument();
  });

  it("orders the printed rows by beam number, not by entry order", () => {
    render(
      <CoveringProgrammeSheet
        open
        onClose={() => {}}
        covering={covering({
          beamEntries: [beam({ beamNo: 7, weight: 30 }), beam({ beamNo: 3, weight: 12 })],
        })}
      />
    );
    const rows = beamBodyRows();
    expect(Array.from(rows[0].querySelectorAll("td")).map((c) => c.textContent))
      .toEqual(["1", "3", "12", ""]);
    expect(Array.from(rows[1].querySelectorAll("td")).map((c) => c.textContent))
      .toEqual(["2", "7", "30", ""]);
  });
});

describe("beamSheetRows", () => {
  // 20 is the floor. A covering that recorded more beams than that gets a
  // row for each — a printed sheet that quietly drops a weight somebody
  // entered is worse than one that runs a little longer.
  it("grows past 20 rather than dropping a recorded beam", () => {
    const entries = Array.from({ length: 23 }, (_, i) =>
      beam({ beamNo: i + 1, weight: i + 1 })
    );
    const [left, right] = beamSheetRows(entries);
    expect(left.length + right.length).toBe(24);
    expect(left).toHaveLength(right.length);
    expect([...left, ...right].filter(Boolean)).toHaveLength(23);
  });

  it("splits evenly so the two printed halves line up", () => {
    const [left, right] = beamSheetRows([]);
    expect(left).toHaveLength(10);
    expect(right).toHaveLength(10);
  });
});
