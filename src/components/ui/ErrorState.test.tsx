import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./ErrorState";
import { DataTable, Column } from "./DataTable";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  AN OUTAGE MUST NOT READ AS "NOTHING HERE"
//
//  Eighteen pages rendered a query result without ever asking whether
//  the query had failed. With the API returning 500 the complaints page
//  said, in a calm grey box:
//
//      No complaints — nothing has been filed under this filter.
//
//  That is the software telling a quality manager that no customer has
//  complained, during an outage. Somebody then acts on it.
//
//  The load-bearing test in this file is the DataTable one: a failed
//  query ALSO has no rows, so the two branches are not independent and
//  the order they are checked in decides whether the table lies.
// ══════════════════════════════════════════════════════════════════

interface Row { id: string; name: string }
const columns: Column<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
];

const table = (props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) =>
  render(
    <DataTable
      columns={columns}
      rows={[]}
      rowKey={(r) => r.id}
      emptyTitle="No complaints"
      emptyDescription="Nothing has been filed under this filter."
      {...props}
    />
  );

describe("the table's three branches", () => {
  it("says nothing is here only when nothing really is", () => {
    table();
    expect(screen.getByText("No complaints")).toBeInTheDocument();
  });

  it("does NOT say nothing is here when the query failed", () => {
    // The exact regression. A failed query has no rows too, so this
    // only passes if the error branch is checked first.
    table({ error: new ApiError("Server error", 500), errorWhat: "complaints" });

    expect(screen.queryByText("No complaints")).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing has been filed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/could not load complaints/i)).toBeInTheDocument();
  });

  it("prefers the loading state over both", () => {
    table({ loading: true, error: new ApiError("Server error", 500) });
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument();
    expect(screen.queryByText("No complaints")).not.toBeInTheDocument();
  });

  it("still draws the rows when there is no error", () => {
    table({ rows: [{ id: "1", name: "Acme" }] });
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });
});

describe("what the error says", () => {
  it("repeats the server's own sentence", () => {
    render(<ErrorState error={new ApiError("Lot ledger is rebuilding", 503)} what="lots" />);
    expect(screen.getByText("Lot ledger is rebuilding")).toBeInTheDocument();
  });

  it("shows the status code, because it decides what to do next", () => {
    render(<ErrorState error={new ApiError("Nope", 403)} what="lots" />);
    expect(screen.getByText(/responded 403/i)).toBeInTheDocument();
  });

  it("turns a bare network failure into something actionable", () => {
    // "Error: Network Error" is not something a person on a shop floor
    // can act on.
    render(<ErrorState error={new Error("Network Error")} what="machines" />);
    expect(screen.getByText(/could not reach the server/i)).toBeInTheDocument();
    expect(screen.getByText(/check the connection/i)).toBeInTheDocument();
  });

  it("still renders for a thrown value it does not recognise", () => {
    render(<ErrorState error={{ weird: true }} what="machines" />);
    expect(screen.getByText(/something went wrong loading machines/i)).toBeInTheDocument();
  });

  it("is announced, not merely drawn", () => {
    // It replaces content the reader was expecting, so it interrupts.
    render(<ErrorState error={new Error("x")} what="machines" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("the way forward", () => {
  it("offers a retry when one is possible", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new Error("x")} what="jobs" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("does not offer one when there is nothing to retry with", () => {
    render(<ErrorState error={new Error("x")} what="jobs" />);
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});
