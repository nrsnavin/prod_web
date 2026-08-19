import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MachineListPage } from "./MachineListPage";
import type { Machine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  LOOM-2 COMES BEFORE LOOM-10
//
//  Machine IDs are a word followed by a number, and sorted as text they
//  come out 1, 10, 11, 2, 3 — an ordering nobody standing in front of
//  the looms recognises. Somebody looking for LOOM-7 in a list of
//  twenty scans past it twice.
//
//  The fix is in DataTable's comparator rather than in a per-column
//  accessor here, because the same shape is everywhere in this system:
//  J-14, DC-0009, WB-0042, lot D-7. One collator option fixes the lot.
//
//  The other thing these hold is that the list OPENS ordered. A table
//  whose first render is whatever order the server returned makes the
//  reader do the sorting themselves before they can start looking.
// ══════════════════════════════════════════════════════════════════

let machines: Machine[];
vi.mock("./hooks", () => ({
  useMachines: () => ({ data: machines, isLoading: false, isError: false, error: null }),
  useMachineMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    setStatus: { mutate: vi.fn(), isPending: false },
  }),
  useMaintenanceDue: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("./MachineHealth", () => ({ MachineHealthBanner: () => null }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

const machine = (over: Partial<Machine> = {}): Machine => ({
  _id: `id-${over.ID ?? Math.random()}`,
  ID: "LOOM-1",
  manufacturer: "Comez",
  NoOfHead: 4,
  NoOfHooks: 12,
  status: "free",
  ...over,
});

function renderList(rows: Machine[]) {
  machines = rows;
  render(
    <MemoryRouter>
      <MachineListPage />
    </MemoryRouter>
  );
}

/** The first cell of every body row, in the order they are drawn. */
const idColumn = () => {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((tr) => within(tr).getAllByRole("cell")[0].textContent);
};

const header = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => { machines = []; });

describe("machine list ordering", () => {
  it("puts LOOM-2 before LOOM-10, not after it", () => {
    // The whole point. Sorted as text this comes out 1, 10, 2, 20, 3.
    renderList([
      machine({ ID: "LOOM-10" }),
      machine({ ID: "LOOM-2" }),
      machine({ ID: "LOOM-20" }),
      machine({ ID: "LOOM-1" }),
      machine({ ID: "LOOM-3" }),
    ]);

    expect(idColumn()).toEqual(["LOOM-1", "LOOM-2", "LOOM-3", "LOOM-10", "LOOM-20"]);
  });

  it("opens sorted, without anybody clicking a header", () => {
    renderList([machine({ ID: "LOOM-9" }), machine({ ID: "LOOM-4" })]);
    expect(idColumn()).toEqual(["LOOM-4", "LOOM-9"]);
  });

  it("still separates different prefixes before comparing numbers", () => {
    // A "pull the digits out" sort would tie these and order them
    // arbitrarily. The letters have to be compared first.
    renderList([
      machine({ ID: "LOOM-2" }),
      machine({ ID: "COMEZ-10" }),
      machine({ ID: "COMEZ-2" }),
    ]);
    expect(idColumn()).toEqual(["COMEZ-2", "COMEZ-10", "LOOM-2"]);
  });

  it("handles zero-padded and bare numbers together", () => {
    renderList([
      machine({ ID: "M-007" }),
      machine({ ID: "M-10" }),
      machine({ ID: "M-2" }),
    ]);
    expect(idColumn()).toEqual(["M-2", "M-007", "M-10"]);
  });

  it("does not fall over on an ID with no number in it", () => {
    renderList([
      machine({ ID: "LOOM-2" }),
      machine({ ID: "SPARE" }),
      machine({ ID: "LOOM-10" }),
    ]);
    expect(idColumn()).toEqual(["LOOM-2", "LOOM-10", "SPARE"]);
  });

  it("reverses on a second click of the same header", async () => {
    renderList([machine({ ID: "LOOM-2" }), machine({ ID: "LOOM-10" })]);
    await userEvent.click(header(/^machine$/i));
    expect(idColumn()).toEqual(["LOOM-10", "LOOM-2"]);
  });

  it("sorts head count as a number, not as text", async () => {
    renderList([
      machine({ ID: "A", NoOfHead: 4 }),
      machine({ ID: "B", NoOfHead: 12 }),
      machine({ ID: "C", NoOfHead: 8 }),
    ]);
    await userEvent.click(header(/^heads$/i));
    expect(idColumn()).toEqual(["A", "C", "B"]);
  });

  it("groups the looms by what they are doing", async () => {
    renderList([
      machine({ ID: "A", status: "running" }),
      machine({ ID: "B", status: "free" }),
      machine({ ID: "C", status: "maintenance" }),
    ]);
    await userEvent.click(header(/^status$/i));
    expect(idColumn()).toEqual(["B", "C", "A"]);
  });

  it("announces which column the table is ordered by", () => {
    // Drawn state is not announced state — without aria-sort a screen
    // reader hears a button and no indication of the current order.
    renderList([machine({ ID: "LOOM-1" })]);
    const headers = screen.getAllByRole("columnheader");
    const machineCol = headers.find((h) => h.textContent?.match(/machine/i))!;
    expect(machineCol).toHaveAttribute("aria-sort", "ascending");

    const hooksCol = headers.find((h) => h.textContent?.match(/hooks/i))!;
    expect(hooksCol).toHaveAttribute("aria-sort", "none");
  });

  it("keeps idle looms together rather than scattered", async () => {
    renderList([
      machine({ ID: "A", orderRunning: { _id: "j1", jobOrderNo: 7 } }),
      machine({ ID: "B" }),
      machine({ ID: "C", orderRunning: { _id: "j2", jobOrderNo: 3 } }),
    ]);
    await userEvent.click(header(/running job/i));
    expect(idColumn()).toEqual(["B", "C", "A"]);
  });
});
