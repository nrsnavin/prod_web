import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BankStatementTab } from "./BankStatementTab";
import type { StatementResult, StoredStatementFull } from "./types";

// Lines the AI placed are marked, can be looked at on their own, and post
// as what they are: invoices settled, a transfer between our accounts,
// an expense under its head, interest. A stored statement can be matched
// again; a line placed by hand can be a transfer or go under a head.

let result: StatementResult;
const uploadStatement = vi.fn();
const postStatement = vi.fn();
const rematchStatement = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    bankFeed: () => Promise.resolve({ configured: false }),
    statements: () => Promise.resolve([]),
    bankAliases: () => Promise.resolve([]),
    uploadStatement: (...a: unknown[]) => uploadStatement(...a),
    postStatement: (...a: unknown[]) => postStatement(...a),
    rematchStatement: (...a: unknown[]) => rematchStatement(...a),
  },
}));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useBankAccounts: () => ({ data: [{ _id: "a1", name: "Kotak CA", kind: "bank", isDefault: true }, { _id: "cash", name: "Cash box", kind: "cash" }, { _id: "sbi", name: "SBI CA", kind: "bank" }] }),
  useCategories: () => ({ data: [{ _id: "h1", name: "Electricity" }, { _id: "h2", name: "Rent" }] }),
}));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "accounts" } }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><BankStatementTab /></MemoryRouter></QueryClientProvider>);
const file = () => new File(["x"], "kotak.csv", { type: "text/csv" });
const line = (index: number, narration: string, amount: number, direction: "in" | "out") => ({ index, date: "2026-07-10", narration, ref: "", amount, direction });

beforeEach(() => {
  uploadStatement.mockReset(); postStatement.mockReset(); rematchStatement.mockReset(); toast.mockReset();
  result = {
    statement: "st1", account: { _id: "a1", name: "Kotak CA" }, file: "kotak.csv", counts: { recorded: 1, matched: 4, unmatched: 1 },
    rows: [
      { ...line(0, "NEFT-SUNRISE-INV/2026-27/0701", 10500, "in"), status: "matched", suggestion: { partyType: "customer", party: "c1", partyName: "Sunrise Garments", allocations: [{ docType: "Invoice", doc: "i1", docNo: "INV/2026-27/0701", amount: 10500 }], confidence: 0.95, reason: "INV/2026-27/0701 named in the narration" } },
      { ...line(1, "NEFT-HDFC-MURUGAN TEX-PYMT 702", 8000, "in"), status: "matched", suggestion: { partyType: "customer", party: "c1", partyName: "Sunrise Garments", allocations: [{ docType: "Invoice", doc: "i2", docNo: "INV/2026-27/0702", amount: 8000 }], confidence: 0.85, byModel: true, reason: "AI: names INV/2026-27/0702, amount exact" } },
      { ...line(2, "BBPS TNEB 0412", 3000, "out"), status: "matched", suggestion: { partyType: "other", party: null, partyName: "TNEB", head: "h1", headName: "Electricity", allocations: [], confidence: 0.8, byModel: true, reason: "AI: TNEB, under Electricity" } },
      { ...line(3, "CASH WDL SELF CHQ 123", 50000, "out"), status: "matched", suggestion: { kind: "contra", partyType: "other", party: null, partyName: "Cash box", account: "cash", accountName: "Cash box", allocations: [], confidence: 0.8, reason: "cash drawn: into Cash box" } },
      { ...line(4, "INT.PD Q2", 412, "in"), status: "matched", suggestion: { partyType: "other", party: null, partyName: "Kotak interest", incomeLedger: "interest", allocations: [], confidence: 0.8, byModel: true, reason: "AI: interest received" } },
      { ...line(5, "IB TRF 99887766 RENT JULY", 25000, "out"), status: "unmatched", suggestion: null, candidates: [] },
      { ...line(6, "SMS CHARGES", 59, "out"), status: "recorded", suggestion: null, recorded: { _id: "p9", voucherNo: "PAY/2026-27/0009", partyName: "Kotak" } },
    ],
  };
  uploadStatement.mockImplementation(async () => result);
});

describe("lines the AI placed", () => {
  it("are marked AI, counted, and can be looked at on their own", async () => {
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), file());
    expect(await screen.findByText(/3 placed by AI — check them/)).toBeInTheDocument();
    const row = (text: string) => screen.getByText(text).closest("tr")!;
    expect(row("NEFT-HDFC-MURUGAN TEX-PYMT 702")).toHaveTextContent("Sunrise Garments → INV/2026-27/0702 ₹8,000.00");
    expect(within(row("NEFT-HDFC-MURUGAN TEX-PYMT 702")).getByText("AI")).toBeInTheDocument();
    expect(row("BBPS TNEB 0412")).toHaveTextContent("TNEB · under Electricity");
    expect(row("CASH WDL SELF CHQ 123")).toHaveTextContent("Transfer to Cash box");
    expect(row("INT.PD Q2")).toHaveTextContent("Kotak interest · interest received");
    // Needs a look: what the AI placed, what is less than sure, what is still to place — not the sure match or the recorded line.
    await userEvent.click(screen.getByRole("button", { name: /Needs a look \(5\)/ }));
    expect(screen.queryByText("NEFT-SUNRISE-INV/2026-27/0701")).not.toBeInTheDocument();
    expect(screen.queryByText("SMS CHARGES")).not.toBeInTheDocument();
    expect(screen.getByText("BBPS TNEB 0412")).toBeInTheDocument();
    expect(screen.getByText("IB TRF 99887766 RENT JULY")).toBeInTheDocument();
  });

  it("post as what they are: invoices, a head, interest, a transfer", async () => {
    postStatement.mockResolvedValue({ success: true, posted: 5, failed: 0, results: [0, 1, 2, 3, 4].map((i) => ({ index: i, ok: true, voucherNo: `V${i}` })) });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), file());
    await userEvent.click(await screen.findByRole("button", { name: /post 5 ticked/i }));
    await waitFor(() => expect(postStatement).toHaveBeenCalled());
    const rows = postStatement.mock.calls[0][1] as Array<Record<string, unknown>>;
    expect(rows[1]).toMatchObject({ partyType: "customer", party: "c1", allocations: [{ docType: "Invoice", doc: "i2", amount: 8000 }] });
    expect(rows[2]).toMatchObject({ partyType: "other", partyName: "TNEB", head: "h1" });
    expect(rows[3]).toMatchObject({ contra: { account: "cash" } });
    expect(rows[3]).not.toHaveProperty("remember");
    expect(rows[4]).toMatchObject({ partyType: "other", incomeLedger: "interest" });
  });

  it("a line placed by hand can be a transfer to another of our accounts, or a payment under a head", async () => {
    postStatement.mockResolvedValue({ success: true, posted: 1, failed: 0, results: [{ index: 0, ok: true, voucherNo: "CTR/2026-27/0003" }] });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), file());
    const rent = (await screen.findByText("IB TRF 99887766 RENT JULY")).closest("tr")!;
    await userEvent.click(within(rent).getByRole("button", { name: /own account/i }));
    expect(within(rent).getByLabelText("Other account, line 6")).toHaveValue("cash");
    await userEvent.selectOptions(within(rent).getByLabelText("Other account, line 6"), "sbi");
    // Changed mind: it is the landlord, under Rent.
    await userEvent.click(within(rent).getByRole("button", { name: "A supplier" }));
    await userEvent.click(within(rent).getByRole("button", { name: "Not a supplier" }));
    await userEvent.selectOptions(within(rent).getByLabelText("Expense head, line 6"), "h2");
    for (const i of [0, 1, 2, 3, 4]) await userEvent.click(screen.getByLabelText(`Post line ${i + 1}`));
    await userEvent.click(screen.getByRole("button", { name: /post 1 ticked/i }));
    await waitFor(() => expect(postStatement).toHaveBeenCalled());
    expect(postStatement.mock.calls[0][1][0]).toMatchObject({ partyType: "other", head: "h2", amount: 25000, direction: "out" });
    expect(postStatement.mock.calls[0][1][0]).not.toHaveProperty("contra");
  });

  it("a stored statement is matched again, and says what changed", async () => {
    const stored: StoredStatementFull = {
      _id: "st1", account: "a1", accountName: "Kotak CA", file: "kotak.csv", from: "2026-07-10", to: "2026-07-10", closingBalance: null, createdAt: "2026-07-11",
      lines: [{ index: 5, date: "2026-07-10", narration: "IB TRF 99887766 RENT JULY", ref: "", amount: 25000, direction: "out", balance: null, status: "matched", voucherType: null, voucher: null, voucherNo: "", note: "",
        suggestion: { partyType: "supplier", party: "s1", partyName: "Lakshmi Estates", allocations: [], confidence: 0.55, byModel: true, reason: "AI: Lakshmi Estates, nothing open: stays on account" } }],
    };
    rematchStatement.mockResolvedValue({ success: true, changed: 1, statement: stored });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), file());
    await userEvent.click(await screen.findByRole("button", { name: /match again/i }));
    expect(rematchStatement).toHaveBeenCalledWith("st1");
    expect(await screen.findByText("Lakshmi Estates")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("1 line placed differently", "success");
  });
});
