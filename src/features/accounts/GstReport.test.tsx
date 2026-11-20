import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportsTab } from "./ReportsTab";
import type { GstRateRow, GstReport } from "./types";

// The GST report: what was charged, what can be claimed, and the net.
// A debit note raised on a customer (interest, a price increase) is more
// output tax; it used to be shown, and taken, off input credit. The net
// rows also carry reverse charge and Rule 37, which the page never showed:
// nobody adding up its tables could arrive at its own "net".

const row = (rate: number, taxable: number, tax: number): GstRateRow => ({ rate, taxable, cgst: tax / 2, sgst: tax / 2, igst: 0, tax });
const zero = { rate: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
const report = (over: Partial<GstReport> = {}): GstReport => ({
  from: "2026-10-01", to: "2026-10-31",
  output: { sales: [row(5, 100000, 5000)], creditNotes: [row(5, 2000, 100)], debitNotes: [row(18, 1000, 180)], reverseCharge: [row(5, 4000, 200)] },
  input: { purchases: [row(5, 40000, 2000)], debitNotes: [row(5, 1000, 50)], expenses: [] },
  totals: {
    output: row(0, 100000, 5000), creditNotes: row(0, 2000, 100), customerDebitNotes: row(0, 1000, 180), reverseCharge: row(0, 4000, 200),
    purchases: row(0, 40000, 2000), debitNotes: row(0, 1000, 50), expenses: zero,
    rule37: { reversed: { cgst: 150, sgst: 150, igst: 0, total: 300 }, reclaimed: { cgst: 0, sgst: 0, igst: 0, total: 0 } },
    netOutput: { cgst: 2640, sgst: 2640, igst: 0 }, netInput: { cgst: 825, sgst: 825, igst: 0 }, payable: { cgst: 1815, sgst: 1815, igst: 0 },
  },
  counts: { invoices: 4, creditNotes: 1, customerDebitNotes: 1, bills: 3, debitNotes: 1, expenses: 0, reverseCharge: 2 },
  ...over,
});
let now: GstReport = report();
vi.mock("./api", () => ({ accountsService: { gst: async () => now, bankAccounts: async () => [] } }));
vi.mock("./PowerCost", () => ({ PowerCost: () => null }));

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ReportsTab /></MemoryRouter></QueryClientProvider>);

describe("the GST report", () => {
  it("puts a debit note raised on a customer under output tax, and a supplier's under input credit", async () => {
    now = report();
    wrap();
    const out = within(await screen.findByLabelText("Output tax"));
    expect(out.getByText("Sales · 4 invoices")).toBeInTheDocument();
    expect(out.getByText("Less credit notes · 1")).toBeInTheDocument();
    expect(out.getByText("Add debit notes to customers · 1")).toBeInTheDocument();
    expect(out.getByRole("table", { name: "Add debit notes to customers · 1" })).toHaveTextContent("18%1,000.0090.0090.000.00180.00");
    const input = within(screen.getByLabelText("Input credit"));
    expect(input.getByText("Less debit notes to suppliers · 1")).toBeInTheDocument();
    expect(input.queryByText(/debit notes to customers/)).not.toBeInTheDocument();
  });

  it("shows the reverse charge and the Rule 37 reversal its net rows already count", async () => {
    now = report();
    wrap();
    const out = within(await screen.findByLabelText("Output tax"));
    expect(out.getByRole("table", { name: "Add reverse charge · 2 bills" })).toHaveTextContent("5%4,000.00100.00100.000.00200.00");
    expect(screen.getByLabelText("Input credit")).toHaveTextContent("Less credit reversed on bills unpaid 180 days (Rule 37)₹300.00");
    expect(screen.getByLabelText("Input credit")).not.toHaveTextContent("re-claimed");
    const net = screen.getByRole("table", { name: "Net position" });
    expect(within(net).getByText("Output tax, net of credit and debit notes").closest("tr")).toHaveTextContent("2,640.002,640.000.00");
    expect(within(net).getByText("Input credit, net of debit notes").closest("tr")).toHaveTextContent("825.00825.000.00");
  });

  it("an older server, which sends neither: the tables it has, and nothing broken", async () => {
    const old = report();
    now = { ...old, output: { sales: old.output.sales, creditNotes: old.output.creditNotes }, totals: { ...old.totals, rule37: undefined, customerDebitNotes: undefined, reverseCharge: undefined }, counts: { invoices: 4, creditNotes: 1, bills: 3, debitNotes: 1, expenses: 0 } };
    wrap();
    const out = within(await screen.findByLabelText("Output tax"));
    expect(out.getByText("Sales · 4 invoices")).toBeInTheDocument();
    expect(out.queryByText(/debit notes to customers/)).not.toBeInTheDocument();
    expect(out.queryByText(/reverse charge/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Input credit")).not.toHaveTextContent("Rule 37");
  });
});
