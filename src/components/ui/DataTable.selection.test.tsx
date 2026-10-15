import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DataTable, Column } from "./DataTable";

type Row = { id: string; name: string };
const rows: Row[] = [{ id: "1", name: "One" }, { id: "2", name: "Two" }, { id: "3", name: "Three" }];
const columns: Column<Row>[] = [{ key: "name", header: "Name", render: (r) => r.name }];

function Harness({ onRowClick, initial = [] as string[] }: { onRowClick?: (r: Row) => void; initial?: string[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  return (
    <>
      <output data-testid="sel">{[...sel].sort().join(",")}</output>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        selection={{ selected: sel, onChange: setSel, label: (r) => `Select ${r.name}` }}
      />
    </>
  );
}

describe("ticking rows", () => {
  it("ticks a row without opening it", async () => {
    const open = vi.fn();
    const u = userEvent.setup();
    render(<Harness onRowClick={open} />);
    await u.click(screen.getByLabelText("Select Two"));
    expect(screen.getByTestId("sel")).toHaveTextContent("2");
    expect(open).not.toHaveBeenCalled();
  });

  it("the header box ticks every shown row, then clears them, keeping rows from elsewhere", async () => {
    const u = userEvent.setup();
    render(<Harness initial={["other-page"]} />);
    await u.click(screen.getByLabelText("Select all shown"));
    expect(screen.getByTestId("sel")).toHaveTextContent("1,2,3,other-page");
    await u.click(screen.getByLabelText("Select all shown"));
    expect(screen.getByTestId("sel")).toHaveTextContent("other-page");
  });

  it("the header box shows 'some' when part of the page is ticked", () => {
    render(<Harness initial={["1"]} />);
    expect((screen.getByLabelText("Select all shown") as HTMLInputElement).indeterminate).toBe(true);
  });

  it("a table without selection draws no boxes", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
