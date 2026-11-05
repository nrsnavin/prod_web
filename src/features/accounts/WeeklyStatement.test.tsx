import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BankStatementTab, guessAlias } from "./BankStatementTab";
import type { BankAlias, StatementResult, StoredStatement } from "./types";

// A statement downloaded every week and uploaded: what to download next,
// how the upload follows the last one, and a payer placed by hand
// remembered for next week.

let statements: StoredStatement[] = [];
let aliases: BankAlias[] = [];
let result: StatementResult;
const uploadStatement = vi.fn();
const postStatement = vi.fn();
const forgetBankAlias = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    bankFeed: () => Promise.resolve({ configured: false }),
    statements: () => Promise.resolve(statements),
    bankAliases: () => Promise.resolve(aliases),
    forgetBankAlias: (...a: unknown[]) => forgetBankAlias(...a),
    uploadStatement: (...a: unknown[]) => uploadStatement(...a),
    postStatement: (...a: unknown[]) => postStatement(...a),
  },
}));
vi.mock("./hooks", () => ({ ACCOUNTS_KEY: "accounts", useBankAccounts: () => ({ data: [{ _id: "a1", name: "Kotak CA", kind: "bank", isDefault: true }] }) }));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "accounts" } }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><BankStatementTab /></MemoryRouter></QueryClientProvider>);
const file = () => new File(["x"], "kotak.csv", { type: "text/csv" });

beforeEach(() => {
  statements = []; aliases = [];
  uploadStatement.mockReset(); postStatement.mockReset(); forgetBankAlias.mockReset().mockResolvedValue({ success: true }); toast.mockReset();
  result = {
    statement: "st9", account: { _id: "a1", name: "Kotak CA" }, file: "kotak.csv", closingBalance: 118500,
    counts: { recorded: 0, matched: 0, unmatched: 1 },
    rows: [{ index: 0, date: "2026-07-14", narration: "NEFT-HDFC0000123-TNEB ONLINE-JULY BILL", ref: "R7", amount: 3000, direction: "out", status: "unmatched", suggestion: null, candidates: [] }],
    continuity: { previous: { file: "week1.csv", from: "2026-07-01", to: "2026-07-07", closingBalance: 100450 }, from: "2026-07-10", to: "2026-07-14", openingBalance: 101450, gapDays: 2, overlapLines: 1, balanceDiff: 1000 },
  };
  uploadStatement.mockImplementation(async () => result);
});

describe("a weekly statement upload", () => {
  it("says what to download next, from the day after the last statement", async () => {
    statements = [{ _id: "s1", account: "a1", accountName: "Kotak CA", file: "week1.csv", from: "2026-07-01", to: "2026-07-07", closingBalance: 100450, createdAt: "2026-07-08", lines: 3, counts: {} }];
    wrap();
    expect(await screen.findByLabelText("Next download")).toHaveTextContent("Last statement for this account runs to 7 Jul 2026 (balance ₹1,00,450.00). Download from 8 Jul 2026 to today");
  });

  it("warns when the balance does not carry over from the last statement, and counts the overlap", async () => {
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), file());
    const note = await screen.findByLabelText("How this statement follows the last");
    expect(note).toHaveTextContent("The balance does not carry over: this statement opens at ₹1,01,450.00, the last one closed at ₹1,00,450.00 — ₹1,000.00 came in on days not in either. Download from 8 Jul 2026 again");
    expect(note).toHaveTextContent("1 line was in an earlier statement too");
  });

  it("a payment to someone not on file is posted under their name, and remembered for next week", async () => {
    result.continuity = { ...result.continuity!, gapDays: 0, overlapLines: 0, balanceDiff: 0 };
    postStatement.mockResolvedValue({ success: true, posted: 1, failed: 0, results: [{ index: 0, ok: true, voucherNo: "PAY/2026-27/0040", remembered: true }] });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), file());
    expect(await screen.findByText(/Follows on from the last statement \(to 7 Jul 2026\) with nothing missing/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Not a supplier" }));
    // The name and what to remember it by are guessed from the narration; both can be changed.
    expect(screen.getByLabelText("Paid to, line 1")).toHaveValue("TNEB ONLINE");
    expect(screen.getByLabelText("Remember this payer, line 1")).toBeChecked();
    expect(screen.getByLabelText("Remember text, line 1")).toHaveValue("TNEB ONLINE");
    await userEvent.clear(screen.getByLabelText("Paid to, line 1"));
    await userEvent.type(screen.getByLabelText("Paid to, line 1"), "TNEB");
    await userEvent.clear(screen.getByLabelText("Remember text, line 1"));
    await userEvent.type(screen.getByLabelText("Remember text, line 1"), "TNEB");
    await userEvent.click(screen.getByRole("button", { name: /post 1 ticked/i }));
    await waitFor(() => expect(postStatement).toHaveBeenCalled());
    expect(postStatement.mock.calls[0][1][0]).toMatchObject({ partyType: "other", partyName: "TNEB", amount: 3000, direction: "out", remember: { text: "TNEB" } });
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/1 voucher posted · 1 payer remembered for next time/), "success");
  });

  it("says when the remembered text is not in the line, and sends nothing to remember once unticked", async () => {
    result.rows = [{ ...result.rows[0], direction: "in", narration: "INTEREST CREDIT Q1" }];
    postStatement.mockResolvedValue({ success: true, posted: 1, failed: 0, results: [{ index: 0, ok: true, voucherNo: "RCT/2026-27/0009" }] });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), file());
    await userEvent.click(await screen.findByRole("button", { name: "Not a customer" }));
    expect(screen.getByLabelText("Received from, line 1")).toHaveValue("INTEREST CREDIT Q1");
    await userEvent.type(screen.getByLabelText("Remember text, line 1"), "X");
    expect(screen.getByText(/not in this line's narration, so it won't be remembered/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Remember this payer, line 1"));
    await userEvent.click(screen.getByRole("button", { name: /post 1 ticked/i }));
    await waitFor(() => expect(postStatement).toHaveBeenCalled());
    expect(postStatement.mock.calls[0][1][0]).not.toHaveProperty("remember");
    expect(postStatement.mock.calls[0][1][0]).toMatchObject({ partyType: "other", direction: "in" });
  });

  it("lists what is remembered and forgets a wrong one", async () => {
    aliases = [{ _id: "al1", text: "MURUGAN K", direction: "in", partyType: "customer", party: "c1", partyName: "Sunrise Garments", lastMatchedAt: "2026-07-13", createdAt: "2026-07-06", updatedAt: "2026-07-06" }];
    wrap();
    const list = await screen.findByRole("list", { name: "Remembered payers" });
    expect(within(list).getByText("MURUGAN K").closest("li")).toHaveTextContent("money in fromSunrise Garmentslast matched 13 Jul 2026");
    await userEvent.click(within(list).getByRole("button", { name: "Forget MURUGAN K" }));
    expect(forgetBankAlias).toHaveBeenCalledWith("al1");
  });
});

describe("guessing what to remember a payer by", () => {
  it("takes a UPI id first, else the longest stretch of words that is not a code or a bank's own word", () => {
    expect(guessAlias("UPI/412345678901/sunrisepay@okaxis/Payment")).toBe("SUNRISEPAY@OKAXIS");
    expect(guessAlias("NEFT-HDFC0000123-MURUGAN K-PAYMENT")).toBe("MURUGAN K");
    expect(guessAlias("IMPS/412312345678/SRI YARN TRADERS/KKBK")).toBe("SRI YARN TRADERS");
    expect(guessAlias("TNEB ONLINE PAYMENT")).toBe("TNEB ONLINE PAYMENT");
    expect(guessAlias("NEFT-412312345678")).toBe("");
  });
});
