import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BankStatementTab } from "./BankStatementTab";
import type { StatementResult, StoredStatementFull } from "./types";

// One line at the bank is one entry in the books. A line somebody else
// placed while this screen was open is answered with the voucher it
// already has, and the screen says so instead of counting a posting. A
// line matched to the wrong entry can be taken off it again; a voucher
// posted from a line is undone by cancelling the voucher, so that line
// has no such button.

let result: StatementResult;
let stored: StoredStatementFull;
const uploadStatement = vi.fn();
const postStatement = vi.fn();
const unlinkLine = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    bankFeed: () => Promise.resolve({ configured: false }),
    statements: () => Promise.resolve([{ _id: "st1", file: "kotak.csv", from: "2026-07-01", to: "2026-07-31", lines: 3, counts: { unmatched: 1 }, createdAt: "2026-08-01", source: "upload" }]),
    storedStatement: () => Promise.resolve(stored),
    bankAliases: () => Promise.resolve([]),
    uploadStatement: (...a: unknown[]) => uploadStatement(...a),
    postStatement: (...a: unknown[]) => postStatement(...a),
    unlinkLine: (...a: unknown[]) => unlinkLine(...a),
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
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const wrap = (at = "/") => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[at]}><BankStatementTab /></MemoryRouter></QueryClientProvider>);
const line = (index: number, narration: string, amount: number, direction: "in" | "out") => ({ index, date: "2026-07-10", narration, ref: "", amount, direction });
const sure = (index: number, narration: string, amount: number, invoice: string) => ({
  ...line(index, narration, amount, "in" as const), status: "matched" as const,
  suggestion: { partyType: "customer" as const, party: "c1", partyName: "Sunrise Garments", allocations: [{ docType: "Invoice" as const, doc: `i${index}`, docNo: invoice, amount }], confidence: 0.95, reason: `${invoice} named in the narration` },
});

beforeEach(() => {
  uploadStatement.mockReset(); postStatement.mockReset(); unlinkLine.mockReset(); toast.mockReset();
  result = {
    statement: "st1", account: { _id: "a1", name: "Kotak CA" }, file: "kotak.csv", counts: { matched: 2 },
    rows: [sure(0, "NEFT-SUNRISE-INV/2026-27/0701", 10500, "INV/2026-27/0701"), sure(1, "NEFT-SUNRISE-INV/2026-27/0702", 8000, "INV/2026-27/0702")],
  } as StatementResult;
  uploadStatement.mockImplementation(async () => result);
  const kept = { balance: null, suggestion: null, candidates: null };
  stored = {
    _id: "st1", account: "a1", file: "kotak.csv", from: "2026-07-01", to: "2026-07-31", closingBalance: null, createdAt: "2026-08-01", source: "upload",
    lines: [
      { ...line(0, "NEFT-SUNRISE 10500", 10500, "in"), ...kept, status: "recorded", voucherType: "Payment", voucher: "p1", voucherNo: "RCT/2026-27/0041", note: "" },
      { ...line(1, "NEFT-SUNRISE 8000", 8000, "in"), ...kept, status: "posted", voucherType: "Payment", voucher: "p2", voucherNo: "RCT/2026-27/0042", note: "" },
      { ...line(2, "IB TRF RENT JULY", 25000, "out"), ...kept, status: "unmatched", voucherType: null, voucher: null, voucherNo: "", note: "" },
    ],
  } as unknown as StoredStatementFull;
});

describe("posting a line that is already in the books", () => {
  it("says which voucher answers it, and does not count it as posted", async () => {
    postStatement.mockResolvedValue({
      success: true, posted: 2, failed: 0,
      results: [{ index: 0, ok: true, voucherNo: "RCT/2026-27/0050", replay: false }, { index: 1, ok: true, voucherNo: "RCT/2026-27/0042", replay: true, already: true }],
    });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), new File(["x"], "kotak.csv", { type: "text/csv" }));
    await userEvent.click(await screen.findByRole("button", { name: /post 2 ticked/i }));
    const first = (await screen.findByText("RCT/2026-27/0050")).closest("tr")!;
    expect(first).toHaveTextContent("NEFT-SUNRISE-INV/2026-27/0701");
    const second = screen.getByText("NEFT-SUNRISE-INV/2026-27/0702").closest("tr")!;
    expect(second).toHaveTextContent("already in the books as RCT/2026-27/0042");
    expect(toast).toHaveBeenCalledWith("1 voucher posted · 1 line was already in the books, nothing posted again", "info");
    // Neither is offered for posting again.
    expect(screen.getByRole("button", { name: /post 0 ticked/i })).toBeDisabled();
  });

  it("a request answered a second time is not counted twice either", async () => {
    postStatement.mockResolvedValue({
      success: true, posted: 2, failed: 0,
      results: [{ index: 0, ok: true, voucherNo: "RCT/2026-27/0050", replay: true }, { index: 1, ok: true, voucherNo: "RCT/2026-27/0051", replay: true }],
    });
    wrap();
    await userEvent.upload(screen.getByLabelText("Bank statement file"), new File(["x"], "kotak.csv", { type: "text/csv" }));
    await userEvent.click(await screen.findByRole("button", { name: /post 2 ticked/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("0 vouchers posted · 2 lines were already in the books, nothing posted again", "info"));
  });
});

describe("a line matched to the wrong entry", () => {
  const openPast = async () => {
    wrap("/?view=past&account=a1&statement=st1");
    return (await screen.findByText("NEFT-SUNRISE 10500")).closest("tr")!;
  };

  it("is taken off it in place, after asking", async () => {
    unlinkLine.mockResolvedValue({ success: true });
    const row = await openPast();
    await userEvent.click(within(row).getByRole("button", { name: /undo match/i }));
    expect(unlinkLine).not.toHaveBeenCalled();
    expect(within(row).getByText("Take RCT/2026-27/0041 off this line?")).toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: "Undo the match" }));
    await waitFor(() => expect(unlinkLine).toHaveBeenCalledWith("st1", 0));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("RCT/2026-27/0041 is off this line — the line is back to be placed", "success"));
  });

  it("can be left as it is", async () => {
    const row = await openPast();
    await userEvent.click(within(row).getByRole("button", { name: /undo match/i }));
    await userEvent.click(within(row).getByRole("button", { name: "Keep" }));
    expect(unlinkLine).not.toHaveBeenCalled();
    expect(within(row).getByRole("button", { name: /undo match/i })).toBeInTheDocument();
  });

  it("says what the server says when the line has moved on", async () => {
    unlinkLine.mockRejectedValue(new Error("That line is not matched to an entry in the books"));
    const row = await openPast();
    await userEvent.click(within(row).getByRole("button", { name: /undo match/i }));
    await userEvent.click(within(row).getByRole("button", { name: "Undo the match" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("That line is not matched to an entry in the books", "error"));
  });

  it("is not offered for a voucher posted from the line, or a line still to place", async () => {
    await openPast();
    const posted = screen.getByText("NEFT-SUNRISE 8000").closest("tr")!;
    expect(within(posted).queryByRole("button", { name: /undo match/i })).not.toBeInTheDocument();
    const open = screen.getByText("IB TRF RENT JULY").closest("tr")!;
    expect(within(open).queryByRole("button", { name: /undo match/i })).not.toBeInTheDocument();
    expect(within(open).getByRole("button", { name: /set aside/i })).toBeInTheDocument();
  });
});
