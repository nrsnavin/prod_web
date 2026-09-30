import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Column, DataTable, phoneRoles } from "./DataTable";

type Job = { id: string; no: string; customer: string; status: string; meters: number };
const rows: Job[] = [
  { id: "1", no: "J-1", customer: "Kaveri Innerwear", status: "weaving", meters: 900 },
  { id: "2", no: "J-2", customer: "Nila Exports", status: "packing", meters: 1200 },
];
const columns: Column<Job>[] = [
  { key: "no", header: "Job #", render: (j) => j.no, sort: (j) => j.no },
  { key: "customer", header: "Customer", render: (j) => j.customer },
  { key: "meters", header: "Meters", align: "right", render: (j) => j.meters, sort: (j) => j.meters },
  { key: "status", header: "Status", render: (j) => <span data-testid="chip">{j.status}</span> },
];

function asViewport(phone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({
      matches: phone && q.includes("max-width"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

afterEach(() => {
  // @ts-expect-error — jsdom has none; put it back that way.
  delete window.matchMedia;
});

describe("DataTable on a phone", () => {
  beforeEach(() => asViewport(true));

  it("shows each row as a card with its status beside the title — no table to slide sideways", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.queryByRole("table")).toBeNull();
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(first.getByText("J-1")).toBeInTheDocument();
    expect(first.getByTestId("chip")).toHaveTextContent("weaving");
    // Every other column is still there, labelled.
    expect(first.getByText("Customer")).toBeInTheDocument();
    expect(first.getByText("Kaveri Innerwear")).toBeInTheDocument();
    expect(first.getByText("Meters")).toBeInTheDocument();
  });

  it("opens a row on tap and on Enter", async () => {
    const open = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={open} />);
    const [first, second] = screen.getAllByRole("button");
    await userEvent.click(first);
    expect(open).toHaveBeenLastCalledWith(rows[0]);
    second.focus();
    await userEvent.keyboard("{Enter}");
    expect(open).toHaveBeenLastCalledWith(rows[1]);
  });

  it("keeps sorting, through a select instead of column headers", async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "meters:-1");
    const titles = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(titles[0]).toContain("J-2"); // 1200 m first
  });

  it("keeps the table where a page asks for it", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} phoneLayout="table" />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("DataTable on a desktop", () => {
  it("is still a table", () => {
    asViewport(false);
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("phoneRoles", () => {
  it("takes the first column as title and the status column as badge", () => {
    expect(phoneRoles(columns)).toEqual(["title", "field", "field", "badge"]);
  });

  it("follows a column's own choice over the defaults", () => {
    const cols: Column<Job>[] = [
      { ...columns[0], phone: "hide" },
      { ...columns[1], phone: "title" },
      columns[2],
      columns[3],
    ];
    expect(phoneRoles(cols)).toEqual(["hide", "title", "field", "badge"]);
  });
});
