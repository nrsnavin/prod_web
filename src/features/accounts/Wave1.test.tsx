import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { InboxTab } from "./InboxTab";
import { ForecastTab } from "./ForecastTab";
import { defaultPeriod, periods, today, ymd } from "./shared";
import type { Forecast, Inbox, Overview } from "./types";

// The inbox says what is overdue and links to the statement that needs
// placing; the forecast lists every item in a week; periods are local dates.

const inbox: Inbox = {
  billsDue: { count: 2, overdue: 1, amount: 120000, top: [
    { docType: "SupplierBill", id: "b1", docNo: "PB/2026-27/0004", date: "2026-09-04", dueDate: "2026-10-04", party: "s1", partyName: "Rubber Thread India", amount: 100624, outstanding: 100624, overdueDays: 30, bucket: "d30" },
    { docType: "SupplierBill", id: "b2", docNo: "PB/2026-27/0001", date: "2026-10-09", dueDate: "2026-11-08", party: "s2", partyName: "Sri Yarn Traders", amount: 19376, outstanding: 19376, overdueDays: 0, bucket: "current" },
  ] },
  approvals: { count: 0, amount: 0, top: [] },
  claimsToPay: { count: 0, amount: 0, top: [] },
  bankLines: { count: 3, amount: 6200, statement: "st1", account: "acc1", accountName: "Kotak CA" },
  toChase: { count: 0, amount: 0, top: [] },
  promisesDue: { count: 0, top: [] },
  variances: { count: 0, top: [] },
};
const overview: Overview = {
  receivables: { total: 0, overdue: 0, count: 0, ageing: { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 }, top: [] },
  payables: { total: 100624, overdue: 100624, count: 1, paidAhead: 10000, ageing: { current: 0, d30: 100624, d60: 0, d90: 0, over90: 0 }, top: [
    { party: "s1", partyName: "Rubber Thread India", total: 100624, overdue: 100624, oldestDays: 30, count: 1, ageing: { current: 0, d30: 100624, d60: 0, d90: 0, over90: 0 }, docs: [], paidAhead: 10000 },
  ] },
  accounts: [], pendingExpenses: 2,
  month: { from: "2026-10-01", to: "2026-10-31", current: false, expenses: { amount: 0, count: 0 }, sales: { amount: 0, outputTax: 0, count: 0 }, purchases: { amount: 0, inputCredit: 0, count: 0 } },
  recentPayments: [],
};
const item = (i: number) => ({ direction: "out" as const, party: `Payee ${i}`, docNo: `EXP/${i}`, amount: 1000 * (10 - i), basis: "expense waiting for approval" });
const forecast: Forecast = {
  opening: 100000, firstShortWeek: null, later: { inflow: 0, outflow: 0 }, habits: 0,
  weeks: [{ from: "2026-11-02", to: "2026-11-08", inflow: 0, outflow: 40000, closing: 60000, top: [1, 2, 3, 4, 5].map(item), items: [1, 2, 3, 4, 5, 6].map(item) }],
};
vi.mock("./api", () => ({ accountsService: { inbox: async () => inbox, forecast: async () => forecast } }));
vi.mock("./hooks", async (orig) => ({ ...(await orig<typeof import("./hooks")>()), useOverview: () => ({ data: overview, isLoading: false, isError: false, error: null }) }));

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("accounts, wave 1", () => {
  it("the inbox says which bills are overdue and opens the statement with lines to place", async () => {
    wrap(<InboxTab />);
    expect(await screen.findByText("Bills due or overdue")).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.getByText(/30d overdue/)).toBeInTheDocument();
    expect(screen.getByText(/due 8 Nov 2026/)).toBeInTheDocument();
    const open = screen.getByRole("link", { name: "Open the statement" });
    expect(open).toHaveAttribute("href", "/accounts/bank?view=past&account=acc1&statement=st1");
    expect(screen.getByText(/for Kotak CA/)).toBeInTheDocument();
  });

  it("the figures under the inbox leave out the approvals count, name last month, and show what was paid ahead", async () => {
    wrap(<InboxTab />);
    await screen.findByText("Bills due or overdue");
    expect(screen.queryByText("Expenses to approve", { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(screen.getByText(/less ₹10,000.00 we paid ahead · net ₹90,624.00/)).toBeInTheDocument();
    expect(screen.getByText(/± transfers/)).toBeInTheDocument();
  });

  it("a forecast week shows its three biggest, and all of them on asking", async () => {
    wrap(<ForecastTab />);
    const table = await screen.findByLabelText("Cash forecast");
    expect(within(table).getAllByText(/expense waiting for approval/)).toHaveLength(3);
    fireEvent.click(within(table).getByRole("button", { name: "Show all 6" }));
    expect(within(table).getAllByText(/expense waiting for approval/)).toHaveLength(6);
    expect(within(table).getByText(/Payee 6/)).toBeInTheDocument();
  });

  it("periods are local dates, April-based, and reports open on last month until the 10th", () => {
    expect(ymd(new Date(2026, 10, 1))).toBe("2026-11-01");
    expect(today()).toBe(ymd(new Date()));
    const p = periods(new Date(2026, 10, 3));
    expect(p.find((x) => x.key === "last")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(p.find((x) => x.key === "quarter")).toMatchObject({ from: "2026-10-01" });
    expect(p.find((x) => x.key === "fy")).toMatchObject({ from: "2026-04-01" });
    expect(periods(new Date(2027, 1, 15)).find((x) => x.key === "quarter")).toMatchObject({ from: "2027-01-01" });
    expect(periods(new Date(2027, 1, 15)).find((x) => x.key === "fy")).toMatchObject({ from: "2026-04-01" });
    expect(defaultPeriod(new Date(2026, 10, 3))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(defaultPeriod(new Date(2026, 10, 12)).from).toBe("2026-11-01");
  });
});
