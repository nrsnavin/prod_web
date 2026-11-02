import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FlagList } from "./Flags";
import { ForecastTab } from "./ForecastTab";
import { CloseTab } from "./CloseTab";
import type { CloseChecklist, Forecast } from "./types";

// The books say what they notice: a flag before saving, the week cash
// runs short, and what is left before the month can close.

const forecast: Forecast = {
  opening: 6000, firstShortWeek: "2026-11-09", later: { inflow: 0, outflow: 0 }, habits: 1,
  weeks: [
    { from: "2026-11-02", to: "2026-11-08", inflow: 0, outflow: 30000, closing: -24000, top: [{ direction: "out", party: "Landlord", docNo: "Factory rent", amount: 30000, basis: "recurring" }] },
    { from: "2026-11-09", to: "2026-11-15", inflow: 20000, outflow: 0, closing: -4000, top: [{ direction: "in", party: "Sunrise", docNo: "INV/2026-27/0092", amount: 20000, basis: "pays in 20 days on average" }] },
  ],
};
const close: CloseChecklist = {
  month: "2026-10", from: "2026-10-01", to: "2026-10-31", done: 1, total: 2,
  items: [
    { key: "photos", label: "Bills have their copy attached", detail: "1 of 3 bills this month have no photo or PDF", count: 1, ok: false, link: "/accounts/bills" },
    { key: "lock", label: "Books locked", detail: "Locked up to 31 Oct 2026", count: 0, ok: true, link: "/accounts/settings" },
  ],
};
vi.mock("./api", () => ({ accountsService: { forecast: async () => forecast, closeChecklist: async () => close } }));

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("what the books notice", () => {
  it("lists flags by how much they matter", () => {
    render(<FlagList flags={[{ code: "SAME_AMOUNT", severity: "danger", message: "₹10,500 from Sri Yarn is already entered as PB/2026-27/0003" }, { code: "OLD_BILL", severity: "info", message: "Claim its input credit this month" }]} />);
    const list = screen.getByLabelText("Checks");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveTextContent("already entered as PB/2026-27/0003");
  });

  it("says the week cash runs short, and why money is expected when", async () => {
    wrap(<ForecastTab />);
    expect(await screen.findByText(/Runs short the week of/)).toBeInTheDocument();
    const table = screen.getByLabelText("Cash forecast");
    expect(table).toHaveTextContent("pays in 20 days on average");
    expect(table).toHaveTextContent("₹-24,000.00");
  });

  it("shows what is left before the month closes", async () => {
    wrap(<CloseTab />);
    const list = await screen.findByLabelText("Month-end checklist");
    expect(list).toHaveTextContent("1 of 3 bills this month have no photo or PDF");
    expect(within(list).getAllByLabelText("to do")).toHaveLength(1);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });
});
