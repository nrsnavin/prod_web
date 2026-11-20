import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BooksSettings } from "./BooksSettings";
import type { AccountsSettings } from "./types";

// ════════════════════════════════════════════════════════════
//  SAVING ONE CARD DOES NOT EMPTY THE OTHERS
//
//  The settings screen is several cards, each with its own Save. Every
//  card was refilled from the server whenever the settings came back —
//  which is what happens when ANY card is saved (and once a minute
//  besides). Somebody halfway through typing thirty Tally ledger names
//  who saved the rate tolerance above them watched the ledger names go
//  back to what they were.
// ════════════════════════════════════════════════════════════

let settings: Partial<AccountsSettings>;
vi.mock("./api", () => ({ accountsService: { learnedPayers: () => Promise.resolve({ enabled: false, after: 5, upTo: 50000, payers: [] }) } }));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useAccountsSettings: () => ({ data: settings }),
  useAccountsMutations: () => new Proxy({}, { get: () => ({ mutate: vi.fn(), isPending: false }) }),
  useLockHistory: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const ui = () => <QueryClientProvider client={new QueryClient()}><MemoryRouter><BooksSettings isAdmin /></MemoryRouter></QueryClientProvider>;

beforeEach(() => {
  settings = { lockDate: null, tally: { sales: "Sales" }, bills: { rateVariancePercent: 2 }, receivables: { interestRate: 18, graceDays: 7 } } as unknown as Partial<AccountsSettings>;
});

describe("the settings cards", () => {
  it("keep what is being typed in one when another is saved", async () => {
    const { rerender } = render(ui());
    const sales = screen.getByLabelText("Sales");
    await userEvent.clear(sales);
    await userEvent.type(sales, "Sales A/c - Elastics");

    // The tolerance card is saved; the settings come back with it changed.
    settings = { ...settings, bills: { rateVariancePercent: 5 } } as Partial<AccountsSettings>;
    rerender(ui());

    expect(screen.getByLabelText("Sales")).toHaveValue("Sales A/c - Elastics");
    // …and the card that WAS saved shows what the server now holds.
    expect(screen.getByLabelText("A billed rate may differ from the PO by (%)")).toHaveValue(5);
  });

  it("take the server's value for a card when that card's own value changes", async () => {
    const { rerender } = render(ui());
    settings = { ...settings, tally: { sales: "Sales - Domestic" } } as Partial<AccountsSettings>;
    rerender(ui());
    expect(screen.getByLabelText("Sales")).toHaveValue("Sales - Domestic");
  });

  it("an unchanged refetch (a new object, the same figures) touches nothing", async () => {
    const { rerender } = render(ui());
    const grace = screen.getByLabelText("Grace days past due");
    await userEvent.clear(grace);
    await userEvent.type(grace, "15");
    settings = JSON.parse(JSON.stringify(settings));
    rerender(ui());
    expect(screen.getByLabelText("Grace days past due")).toHaveValue(15);
  });
});
