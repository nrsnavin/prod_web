// ══════════════════════════════════════════════════════════════════
//  STATEMENTS FROM THE BANK — THE CARD
//
//    • a statement that failed shows why, and what reads it again
//    • with "post without a person" on and no mail host named, the card
//      says whose word is taken for "signed" — and nothing when the
//      host is named, or the option is off
// ══════════════════════════════════════════════════════════════════
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { BankFeedStatus } from "./types";

const feed = vi.fn();
vi.mock("./api", () => ({
  ACCOUNTS_KEY: "accounts",
  accountsService: { bankFeed: () => feed(), runBankFeed: vi.fn(), setBankFeed: vi.fn() },
}));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/ui/Toast", async (orig) => ({ ...(await orig<object>()), useToast: () => ({ toast: vi.fn() }) }));

import { BankFeedCard } from "./BankStatementTab";

const base: BankFeedStatus = {
  configured: true, mailbox: "statements@example.com", everyMin: 15, senders: ["@kotak.com"], autoPost: false, authServer: "",
  sftp: null, lastRunAt: "2026-11-20T04:00:00.000Z", lastResult: null, recent: [],
};
const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
);

beforeEach(() => feed.mockReset());

describe("statements from the bank", () => {
  it("shows why a statement failed and what reads it again", async () => {
    feed.mockResolvedValue({
      ...base,
      recent: [{
        _id: "m1", from: "statements@kotak.com", subject: "Your statement", receivedAt: "2026-11-20T03:00:00.000Z", status: "failed",
        note: "Could not tell which bank account: no account number in the mail, and no account set to this sender. Set \"Statements come from\" on the account, or include the account number in the statement name. Then check the mailbox again: a statement that failed is read again when a person asks.",
      }],
    });
    render(wrap(<BankFeedCard onOpen={() => {}} />));
    expect(await screen.findByText("failed")).toBeInTheDocument();
    expect(screen.getByText(/Could not tell which bank account/)).toHaveTextContent(/check the mailbox again/i);
    expect(screen.getByRole("button", { name: /Check the mailbox now/ })).toBeInTheDocument();
  });

  it("says whose word is taken for a signed mail only when lines post by themselves and no mail host is named", async () => {
    feed.mockResolvedValue({ ...base, autoPost: true });
    const first = render(wrap(<BankFeedCard onOpen={() => {}} />));
    expect(await screen.findByRole("note", { name: "Mail host not named" })).toHaveTextContent(/BANK_FEED_AUTHSERV/);
    first.unmount();

    feed.mockResolvedValue({ ...base, autoPost: true, authServer: "mx1.hostinger.com" });
    const named = render(wrap(<BankFeedCard onOpen={() => {}} />));
    await screen.findByText(/Statements from the bank/);
    expect(screen.queryByRole("note", { name: "Mail host not named" })).toBeNull();
    named.unmount();

    feed.mockResolvedValue({ ...base, autoPost: false });
    render(wrap(<BankFeedCard onOpen={() => {}} />));
    await screen.findByText(/Statements from the bank/);
    expect(screen.queryByRole("note", { name: "Mail host not named" })).toBeNull();
  });
});
