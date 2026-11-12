import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BooksSettings } from "./BooksSettings";
import type { AccountsSettings, LockEvent } from "./types";

// Two things the settings screen gained with the audit fixes.
//
// The lock's history: every time the books were closed, moved or
// reopened, and every entry an admin let through the lock, with who and
// why — it used to be one date and one name, overwritten each time.
//
// How interest on overdue invoices is worked: on what an invoice still
// owes today (the way it always was), or on each part for the days it
// was unpaid. It is the owner's choice, and is saved with the rate.

let settings: Partial<AccountsSettings>;
let history: LockEvent[];
const historyAsked = vi.fn();
const save = vi.fn();
vi.mock("./hooks", () => ({
  useAccountsSettings: () => ({ data: settings }),
  useAccountsMutations: () => new Proxy({}, { get: (_t, k) => (k === "saveAccountsSettings" ? { mutate: save, isPending: false } : { mutate: vi.fn(), isPending: false }) }),
  // Fetched only once the history is opened.
  useLockHistory: (enabled: boolean) => { historyAsked(enabled); return { data: enabled ? history : undefined, isLoading: false }; },
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = (isAdmin = true) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><BooksSettings isAdmin={isAdmin} /></MemoryRouter></QueryClientProvider>);

beforeEach(() => {
  historyAsked.mockReset(); save.mockReset();
  settings = { lockDate: "2026-09-30T00:00:00.000Z", lockedBy: "Owner", receivables: { interestRate: 18, graceDays: 7 } } as Partial<AccountsSettings>;
  history = [
    { _id: "h4", kind: "override", lockDate: "2026-09-30T00:00:00.000Z", reason: "Bank charge found after the month closed", byName: "Owner", at: "2026-10-12T06:00:00Z", entry: { date: "2026-09-28T00:00:00.000Z", cancelling: false } },
    { _id: "h3", kind: "reopened", lockDate: "2026-08-31T00:00:00.000Z", previousLockDate: "2026-09-30T00:00:00.000Z", reason: "A September bill came late", byName: "Owner", at: "2026-10-05T06:00:00Z" },
    { _id: "h2", kind: "closed", lockDate: "2026-09-30T00:00:00.000Z", previousLockDate: "2026-08-31T00:00:00.000Z", via: "tally-export", byName: "Meena", at: "2026-10-03T06:00:00Z" },
    { _id: "h1", kind: "closed", lockDate: "2026-08-31T00:00:00.000Z", via: "before-history", at: "2026-09-02T06:00:00Z" },
  ] as LockEvent[];
});

describe("the lock's history", () => {
  it("is folded away, and read only when it is opened", async () => {
    wrap();
    expect(screen.queryByRole("table", { name: "Lock history" })).not.toBeInTheDocument();
    expect(historyAsked).toHaveBeenLastCalledWith(false);
    await userEvent.click(screen.getByRole("button", { name: "Show the lock's history" }));
    expect(historyAsked).toHaveBeenLastCalledWith(true);
    const rows = within(screen.getByRole("table", { name: "Lock history" })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    // An entry an admin let through: what it was, who, and why.
    expect(rows[0]).toHaveTextContent("Let through: an entry dated 28 Sep 2026");
    expect(rows[0]).toHaveTextContent("Owner");
    expect(rows[0]).toHaveTextContent("Bank charge found after the month closed");
    // Reopened, with where it stood before.
    expect(rows[1]).toHaveTextContent("Reopened up to 31 Aug 2026 (was 30 Sep 2026)");
    expect(rows[1]).toHaveTextContent("A September bill came late");
    // Closed by the Tally export; and the lock as it stood when the history began.
    expect(rows[2]).toHaveTextContent("Closed up to 30 Sep 2026");
    expect(rows[2]).toHaveTextContent("Sent to Tally");
    expect(rows[3]).toHaveTextContent("As it stood when the history began");
    await userEvent.click(screen.getByRole("button", { name: "Hide the lock's history" }));
    expect(screen.queryByRole("table", { name: "Lock history" })).not.toBeInTheDocument();
  });

  it("says so when the books have never been closed", async () => {
    history = [];
    wrap();
    await userEvent.click(screen.getByRole("button", { name: "Show the lock's history" }));
    expect(screen.getByText("Nothing yet: the books have not been closed.")).toBeInTheDocument();
  });
});

describe("how overdue interest is worked", () => {
  it("stands as it always was until the owner changes it, and is saved with the rate", async () => {
    wrap();
    const basis = screen.getByLabelText("Interest is worked on");
    expect(basis).toHaveValue("balance");
    expect(screen.getByText("An invoice paid late in full bears no interest; a part paid late is not charged for those days.")).toBeInTheDocument();
    await userEvent.selectOptions(basis, "payments");
    expect(screen.getByText("An invoice paid late is charged for its lateness, even when it is paid in full by now.")).toBeInTheDocument();
    const card = basis.closest("div.p-5") ?? document.body;
    await userEvent.click(within(card as HTMLElement).getByRole("button", { name: /save/i }));
    expect(save.mock.calls[0][0]).toMatchObject({ receivables: { interestRate: 18, graceDays: 7, interestBasis: "payments" } });
  });

  it("shows the basis that is saved, and only an admin may change it", () => {
    settings = { ...settings, receivables: { interestRate: 18, graceDays: 7, interestBasis: "payments" } } as Partial<AccountsSettings>;
    wrap(false);
    expect(screen.getByLabelText("Interest is worked on")).toHaveValue("payments");
    expect(screen.getByLabelText("Interest is worked on")).toBeDisabled();
  });
});
