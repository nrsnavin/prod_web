import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { DataTable, type Column } from "./DataTable";
import { SavedViews } from "./SavedViews";
import { useUrlState, useUrlFlag } from "@/core/hooks/useUrlState";

// Lists that remember: filters in the address, saved views, the columns
// each person chooses, and a totals row over every row the table holds.

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.search}</output>;
}

type Row = { id: string; name: string; metres: number; value: number };
const rows: Row[] = [
  { id: "a", name: "20mm Knitted", metres: 1200, value: 15000 },
  { id: "b", name: "12mm Woven", metres: 800, value: 9600 },
];
const columns: Column<Row>[] = [
  { key: "name", header: "Elastic", render: (r) => r.name },
  { key: "metres", header: "Metres", align: "right", render: (r) => r.metres, total: (rs) => rs.reduce((s, r) => s + r.metres, 0) },
  { key: "value", header: "Value", align: "right", render: (r) => r.value, total: (rs) => rs.reduce((s, r) => s + r.value, 0) },
  { key: "notes", header: "Notes", defaultHidden: true, render: () => "spare" },
];

beforeEach(() => localStorage.clear());

describe("the totals row", () => {
  it("adds up every row, and labels the foot", () => {
    render(<MemoryRouter><DataTable columns={columns} rows={rows} rowKey={(r) => r.id} totalLabel="2 elastics" /></MemoryRouter>);
    const foot = screen.getByText("2 elastics").closest("tr")!;
    expect(within(foot).getByText("2000")).toBeInTheDocument();
    expect(within(foot).getByText("24600")).toBeInTheDocument();
  });
});

describe("choosing columns", () => {
  it("hides a column until it is chosen, and remembers the choice", async () => {
    const { unmount } = render(<MemoryRouter><DataTable columns={columns} rows={rows} rowKey={(r) => r.id} tableId="t1" /></MemoryRouter>);
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Choose columns" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Notes" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Value" }));
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
    // The name column can't be hidden: a row must stay tellable apart.
    expect(screen.getByRole("checkbox", { name: "Elastic" })).toBeDisabled();
    unmount();
    render(<MemoryRouter><DataTable columns={columns} rows={rows} rowKey={(r) => r.id} tableId="t1" /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
  });
});

function Filters() {
  const [status, setStatus] = useUrlState<"all" | "open" | "closed">("status", "all", ["all", "open", "closed"]);
  const [late, setLate] = useUrlFlag("late");
  return (
    <>
      <p>status: {status}</p>
      <button onClick={() => setStatus("open", { page: null })}>Open</button>
      <button onClick={() => setStatus("all")}>All</button>
      <button onClick={() => setLate(!late)}>Late</button>
      <SavedViews tableId="t2" views={[{ name: "Everything", params: {} }, { name: "Open ones", params: { status: "open" } }]} keys={["status", "late"]} />
      <Where />
    </>
  );
}

describe("filters in the address", () => {
  it("keeps the filter in the URL, leaves the default out, and ignores a value it doesn't know", async () => {
    render(<MemoryRouter initialEntries={["/x?status=bogus&page=3"]}><Filters /></MemoryRouter>);
    expect(screen.getByText("status: all")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByTestId("where")).toHaveTextContent("?status=open");
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByTestId("where").textContent).toBe("");
  });
});

describe("saved views", () => {
  it("names the view the filters match, applies one, and saves the current filters under a name", async () => {
    render(<MemoryRouter initialEntries={["/x"]}><Filters /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /view: everything/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /view:/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Open ones" }));
    expect(screen.getByText("status: open")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Late" }));
    expect(screen.getByRole("button", { name: /view: custom/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /view:/i }));
    await userEvent.click(screen.getByRole("button", { name: "Save these filters as a view…" }));
    await userEvent.type(screen.getByLabelText("Name for this view"), "My late open orders");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: /view: my late open orders/i })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("jarvis.views.t2")!)).toEqual([{ name: "My late open orders", params: { status: "open", late: "1" } }]);
  });
});
