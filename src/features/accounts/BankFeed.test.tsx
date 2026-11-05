import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BankStatementTab, storedToResult } from "./BankStatementTab";
import type { BankFeedStatus, StoredStatementFull } from "./types";

// Statements the bank emails: the Bank tab says how to set the mailbox up
// until it is, then shows what each mail became and opens a mailed
// statement to match and post, carrying what the matcher proposed then.

const stored: StoredStatementFull = {
  _id: "st1", account: "a1", accountName: "Kotak CA", file: "statement.csv", source: "email", from: "2026-10-01", to: "2026-10-02", closingBalance: 50000,
  createdAt: "2026-10-02T04:00:00Z",
  lines: [
    { index: 0, date: "2026-10-01", narration: "NEFT ACME INV/2026-27/0701", ref: "", amount: 10500, direction: "in", balance: null, status: "matched", voucherType: null, voucher: null, voucherNo: "", note: "",
      suggestion: { partyType: "customer", party: "c1", partyName: "Acme Textiles", allocations: [{ docType: "Invoice", doc: "i1", docNo: "INV/2026-27/0701", amount: 10500 }], confidence: 0.97, reason: "Invoice number in the narration, amount exact" } },
    { index: 1, date: "2026-10-01", narration: "CHQ 101 LANDLORD", ref: "", amount: 6300, direction: "out", balance: null, status: "recorded", voucherType: "Payment", voucher: "p1", voucherNo: "PAY/2026-27/0002", note: "" },
    { index: 2, date: "2026-10-02", narration: "UPI SOMEONE", ref: "", amount: 999, direction: "in", balance: null, status: "unmatched", voucherType: null, voucher: null, voucherNo: "", note: "", candidates: [] },
    { index: 3, date: "2026-10-02", narration: "OLD LINE", ref: "", amount: 50, direction: "out", balance: null, status: "matched", voucherType: null, voucher: null, voucherNo: "", note: "" },
  ],
};

let feed: BankFeedStatus;
const runBankFeed = vi.fn();
const postStatement = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    bankFeed: () => Promise.resolve(feed),
    runBankFeed: () => runBankFeed(),
    setBankFeed: vi.fn(),
    storedStatement: () => Promise.resolve(stored),
    postStatement: (...a: unknown[]) => postStatement(...a),
    statements: () => Promise.resolve([]),
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

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><BankStatementTab /></MemoryRouter></QueryClientProvider>);

const configured = (): BankFeedStatus => ({
  configured: true, mailbox: "statements@acme.in", everyMin: 30, senders: ["@kotak.com"], autoPost: false,
  lastRunAt: "2026-10-02T04:00:00Z", lastResult: { trigger: "timer", at: "2026-10-02T04:00:00Z", checked: 2, imported: 1, nothingNew: 0, skipped: 1, failed: 0, newLines: 4, posted: 0 },
  recent: [
    { _id: "m1", from: "alerts@kotak.com", subject: "Account statement 01-Oct to 02-Oct", receivedAt: "2026-10-02T03:59:00Z", status: "imported", accountName: "Kotak CA", account: "a1", statement: "st1", lines: 4, newLines: 4, posted: 0, note: "" },
    { _id: "m2", from: "alerts@kotak.com", subject: "Statement (PDF)", receivedAt: "2026-10-02T03:58:00Z", status: "skipped", note: "A PDF statement cannot be read — set the bank's scheduled statement to CSV or Excel" },
  ],
});

beforeEach(() => { runBankFeed.mockReset(); postStatement.mockReset(); });

describe("statements by email", () => {
  it("says how to set the mailbox up until it is", async () => {
    feed = { configured: false, mailbox: "", everyMin: 0, senders: [], autoPost: false, lastRunAt: null, lastResult: null, recent: [] };
    wrap();
    expect(await screen.findByText("Get statements from the bank instead of uploading them")).toBeInTheDocument();
    expect(screen.getByText("CSV or Excel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Check the mailbox now/ })).not.toBeInTheDocument();
  });

  it("shows each mail and checks the mailbox on request", async () => {
    feed = configured();
    runBankFeed.mockResolvedValue({ success: true, result: { ...feed.lastResult!, trigger: "manual" }, feed });
    wrap();
    expect(await screen.findByText(/statements@acme\.in · checked every 30 min/)).toBeInTheDocument();
    expect(screen.getByText("1 statement read · 4 new lines · 1 not read")).toBeInTheDocument();
    const mails = screen.getByLabelText("Statements received");
    expect(within(mails).getByText(/A PDF statement cannot be read/)).toBeInTheDocument();
    // Only an admin turns on posting without a person.
    expect(screen.getByRole("checkbox", { name: /Post lines it is sure of/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Check the mailbox now/ }));
    expect(runBankFeed).toHaveBeenCalled();
  });

  it("opens a mailed statement with its suggestions and posts against that statement", async () => {
    feed = configured();
    postStatement.mockResolvedValue({ success: true, results: [{ index: 0, ok: true, voucherNo: "REC/2026-27/0009" }], posted: 1, failed: 0 });
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Match lines" }));
    expect(await screen.findByText("Acme Textiles")).toBeInTheDocument();
    expect(screen.getByText(/Already recorded as PAY\/2026-27\/0002/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Post 1 ticked/ }));
    expect(postStatement).toHaveBeenCalledWith("a1", [expect.objectContaining({ index: 0, party: "c1", requestId: "st1:0:10500", allocations: [{ docType: "Invoice", doc: "i1", amount: 10500 }] })], "st1");
    expect(await screen.findByText("REC/2026-27/0009")).toBeInTheDocument();
  });
});

describe("statements by SFTP", () => {
  it("names the SFTP folder, warns until its key is set, and marks files apart from mails", async () => {
    feed = {
      ...configured(), mailbox: "", sftp: { host: "sftp.kotak.com", dir: "/out", hostKeySet: false },
      lastResult: { trigger: "timer", at: "2026-10-02T04:00:00Z", checked: 0, imported: 0, nothingNew: 0, skipped: 0, failed: 0, newLines: 0, posted: 0, error: "SFTP: The SFTP server offered the key SHA256:abc. Check it with the bank, then set BANK_SFTP_HOST_KEY to it — nothing is read until then." },
      recent: [{ _id: "f1", channel: "sftp", from: "sftp://sftp.kotak.com", subject: "KOTAK_20261001.sta", receivedAt: "2026-10-01T18:00:00Z", status: "imported", accountName: "Kotak CA, Kotak OD", account: "a1", statement: "st1", newLines: 2, posted: 0, note: "" }],
    };
    wrap();
    expect(await screen.findByText(/sftp:\/\/sftp\.kotak\.com\/out · checked every 30 min/)).toBeInTheDocument();
    expect(screen.getByText(/The SFTP server's key is not set yet/)).toBeInTheDocument();
    expect(screen.getByText(/offered the key SHA256:abc/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Statements received")).getByLabelText("SFTP file")).toBeInTheDocument();
    expect(screen.getByText("KOTAK_20261001.sta")).toBeInTheDocument();
  });
});

describe("a stored statement on the match screen", () => {
  it("keeps what was placed and sends lines without a kept suggestion to a person", () => {
    const r = storedToResult(stored);
    expect(r.rows.map((x) => x.status)).toEqual(["matched", "recorded", "unmatched", "unmatched"]);
    expect(r.counts).toEqual({ recorded: 1, matched: 1, unmatched: 2, ignored: 0 });
    expect(r.rows[1].recorded?.voucherNo).toBe("PAY/2026-27/0002");
    expect(r.statement).toBe("st1");
  });
});
