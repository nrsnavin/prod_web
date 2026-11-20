import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BankStatementTab } from "./BankStatementTab";
import type { StatementResult } from "./types";

// ════════════════════════════════════════════════════════════
//  THE HEADLINE OVER A STATEMENT COUNTS ITS ROWS
//
//  "4 matched · 2 to place" was what the server said when the file was
//  read, and stayed that through the sitting: after the four were posted
//  and one of the two set aside, the rows below said so and the line
//  above them still read "4 matched · 2 to place". Somebody closing the
//  screen on that headline goes looking for six lines that are done.
// ════════════════════════════════════════════════════════════

let result: StatementResult;
const postStatement = vi.fn();
const ignoreLine = vi.fn();
const reconciliation = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    bankFeed: () => Promise.resolve({ configured: false }),
    statements: () => Promise.resolve([]),
    bankAliases: () => Promise.resolve([]),
    uploadStatement: async () => result,
    postStatement: (...a: unknown[]) => postStatement(...a),
    ignoreLine: (...a: unknown[]) => ignoreLine(...a),
    reconciliation: (...a: unknown[]) => reconciliation(...a),
  },
}));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useBankAccounts: () => ({ data: [{ _id: "a1", name: "Kotak CA", kind: "bank", isDefault: true }] }),
  useCategories: () => ({ data: [] }),
}));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "accounts" } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><BankStatementTab /></MemoryRouter></QueryClientProvider>);
const line = (index: number, narration: string, amount: number, direction: "in" | "out") => ({ index, date: "2026-07-10", narration, ref: "", amount, direction });
const sure = (index: number, no: string, amount: number) => ({
  ...line(index, `NEFT-SUNRISE-${no}`, amount, "in" as const), status: "matched" as const,
  suggestion: { partyType: "customer" as const, party: "c1", partyName: "Sunrise Garments", allocations: [{ docType: "Invoice" as const, doc: `i${index}`, docNo: no, amount }], confidence: 0.95, reason: `${no} named in the narration` },
});

beforeEach(() => {
  postStatement.mockReset(); ignoreLine.mockReset(); reconciliation.mockReset();
  result = {
    statement: "st1", account: { _id: "a1", name: "Kotak CA" }, file: "kotak.csv", counts: { recorded: 1, matched: 2, unmatched: 2 },
    rows: [
      sure(0, "INV/2026-27/0701", 10500),
      sure(1, "INV/2026-27/0702", 8000),
      { ...line(2, "IB TRF 99887766 RENT JULY", 25000, "out"), status: "unmatched", suggestion: null, candidates: [] },
      { ...line(3, "REV TEST DEBIT", 1, "out"), status: "unmatched", suggestion: null, candidates: [] },
      { ...line(4, "SMS CHARGES", 59, "out"), status: "recorded", suggestion: null, recorded: { _id: "p9", voucherNo: "PAY/2026-27/0009", partyName: "Kotak" } },
    ],
  } as StatementResult;
});

describe("the counts over a statement being matched", () => {
  it("move as lines are posted and set aside", async () => {
    postStatement.mockResolvedValue({ success: true, posted: 2, failed: 0, results: [{ index: 0, ok: true, voucherNo: "RCT/1" }, { index: 1, ok: true, voucherNo: "RCT/2" }] });
    ignoreLine.mockResolvedValue({ success: true });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), new File(["x"], "kotak.csv", { type: "text/csv" }));
    expect(await screen.findByText("2 matched")).toBeInTheDocument();
    expect(screen.getByText("2 to place")).toBeInTheDocument();
    expect(screen.getByText("1 already recorded")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Post 2 ticked/ }));
    await waitFor(() => expect(screen.getByText("RCT/1")).toBeInTheDocument());
    expect(screen.getByText("0 matched")).toBeInTheDocument();
    expect(screen.getByText("3 already recorded")).toBeInTheDocument();
    expect(screen.getByText("2 to place")).toBeInTheDocument();

    const row = screen.getByText("REV TEST DEBIT").closest("tr")!;
    await userEvent.click(Array.from(row.querySelectorAll("button")).find((b) => /Set aside/.test(b.textContent ?? ""))!);
    await userEvent.type(within(await screen.findByRole("dialog")).getByRole("textbox"), "Reversed test debit by the bank");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Set aside" }));
    await waitFor(() => expect(screen.getByText("1 to place")).toBeInTheDocument());
    expect(screen.getByText("1 set aside")).toBeInTheDocument();
  });

  it("a line that failed to post is still to be dealt with", async () => {
    postStatement.mockResolvedValue({ success: true, posted: 1, failed: 1, results: [{ index: 0, ok: true, voucherNo: "RCT/1" }, { index: 1, ok: false, error: "INV/2026-27/0702 is already settled" }] });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), new File(["x"], "kotak.csv", { type: "text/csv" }));
    await userEvent.click(await screen.findByRole("button", { name: /Post 2 ticked/ }));
    await waitFor(() => expect(screen.getByText("RCT/1")).toBeInTheDocument());
    expect(screen.getByText("1 matched")).toBeInTheDocument();
    expect(screen.getByText("2 already recorded")).toBeInTheDocument();
  });
});

describe("the reconciliation, while the bank's balance is being typed", () => {
  it("keeps the figures on screen instead of blanking them at every digit", async () => {
    const answer = (bankBalance: number | null) => ({
      bookBalance: 1000, expectedBankBalance: 1000, bankBalance, difference: bankBalance === null ? null : bankBalance - 1000, bankBalanceFrom: null,
      totals: { unclearedIn: 0, unclearedOut: 0, unmatchedIn: 0, unmatchedOut: 0 }, uncleared: [], unmatched: [],
    });
    const waiting: Array<() => void> = [];
    reconciliation.mockImplementation((_a: string, _d: string, bal: number | "") => bal === ""
      ? Promise.resolve(answer(null))
      : new Promise((res) => { waiting.push(() => res(answer(Number(bal)))); }));
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Reconcile" }));
    expect(await screen.findByText("Balance in the books")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Bank's balance"), "9");
    // The new answer has not come: the last one is still there to read.
    expect(screen.getByText("Balance in the books")).toBeInTheDocument();
    waiting.forEach((go) => go());
    await waitFor(() => expect(screen.getByText(/to find/)).toBeInTheDocument());
  });
});
