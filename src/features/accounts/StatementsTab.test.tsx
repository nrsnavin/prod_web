import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatementsTab } from "./StatementsTab";
import type { GroupSummary, Statement } from "./types";

// Customers' and suppliers' accounts the way Tally keeps them: the group
// summary first, then a party's ledger with To / By, voucher type and
// number, Dr / Cr balances, Current Total and Closing Balance, and the
// detailed view with each voucher's breakup and the bills it settled.

const summary: GroupSummary = {
  partyType: "customer", group: "Sundry Debtors",
  rows: [{ party: "c1", partyName: "Sunrise Garments", gstin: "33AAEPS1001F1Z2", opening: 10500, openingSide: "Dr", debit: 0, credit: 10575, closing: -75, closingSide: "Cr" }],
  totals: { opening: 10500, openingSide: "Dr", debit: 0, credit: 10575, closing: -75, closingSide: "Cr" },
};
const statement: Statement = {
  party: { _id: "c1", name: "Sunrise Garments", gstin: "33AAEPS1001F1Z2" }, partyType: "customer",
  opening: 0, openingSide: "", closing: -75, closingSide: "Cr", totals: { debit: 10500, credit: 10575 },
  open: { total: 0, overdue: 0, count: 0 } as Statement["open"],
  rows: [
    { _id: "e1", date: "2026-06-01", docType: "Invoice", doc: "i1", docNo: "INV/2026-27/0001", debit: 10500, credit: 0, balance: 10500, balanceSide: "Dr", toBy: "To", particulars: "Sales", vchType: "Sales", partyRef: "PO SG/PO/88",
      lines: [{ ledger: "Sales", amount: 10000 }, { ledger: "Output CGST", amount: 250 }, { ledger: "Output SGST", amount: 250 }], refs: [] },
    { _id: "e2", date: "2026-06-20", docType: "Payment", doc: "p1", docNo: "REC/2026-27/0001", debit: 0, credit: 10050, balance: 450, balanceSide: "Dr", toBy: "By", particulars: "Kotak Mahindra Bank", vchType: "Receipt", partyRef: "UTR123",
      lines: [{ ledger: "Kotak Mahindra Bank", amount: 10000 }, { ledger: "Bank Charges", amount: 50 }], refs: [{ type: "Agst Ref", name: "INV/2026-27/0001", amount: 10050 }] },
    // A cheque that bounced: shown, not counted.
    { _id: "p2:entered", memo: "cheque-entered", date: "2026-06-22", docType: "Payment", doc: "p2", docNo: "REC/2026-27/0002", debit: 0, credit: 0, balance: 450, balanceSide: "Dr", particulars: "Cheque 004512 (bounced)", vchType: "Receipt", partyRef: "Indian Bank · ₹450.00 · not counted" },
    { _id: "p2:returned", memo: "cheque-returned", date: "2026-06-25", docType: "Payment", doc: "p2", docNo: "REC/2026-27/0002", debit: 0, credit: 0, balance: 450, balanceSide: "Dr", particulars: "Cheque 004512 returned", vchType: "Bounced", partyRef: "₹450.00 · Insufficient funds" },
  ],
};

vi.mock("./hooks", () => ({
  useLedgerSummary: () => ({ data: summary, isLoading: false }),
  useStatement: (_t: unknown, party?: string) => ({ data: party ? statement : undefined, isLoading: false }),
  useOutstanding: () => ({ data: undefined }),
}));
vi.mock("./Credits", () => ({ CreditsCard: () => null }));
vi.mock("./Share", () => ({ ShareDialog: () => null }));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));

const wrap = (at = "/accounts/statements") => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[at]}><StatementsTab /></MemoryRouter></QueryClientProvider>);

describe("customers' and suppliers' accounts", () => {
  it("opens on the group summary, each balance Dr or Cr", async () => {
    wrap();
    const table = screen.getByRole("table", { name: "Sundry Debtors" });
    expect(within(table).getByText("Sunrise Garments")).toBeInTheDocument();
    expect(within(table).getAllByText("10,500.00 Dr").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("75.00 Cr").length).toBeGreaterThan(0);
    expect(within(table).getByText("Grand Total")).toBeInTheDocument();
    // The financial year to date, as Tally opens.
    expect(screen.getByText(/Group summary · 1 Apr 20\d\d to /)).toBeInTheDocument();
  });

  it("shows a party's ledger the way Tally prints it", async () => {
    wrap();
    await userEvent.click(screen.getByRole("button", { name: "Sunrise Garments" }));
    const ledger = screen.getByRole("table", { name: "Ledger account" });
    const head = within(ledger).getAllByRole("columnheader").map((h) => h.textContent);
    expect(head).toEqual(["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit", "Balance"]);
    expect(within(ledger).getByText("Opening Balance")).toBeInTheDocument();
    const [, , inv, rec] = within(ledger).getAllByRole("row");
    expect(inv).toHaveTextContent("To Sales");
    expect(inv).toHaveTextContent("PO SG/PO/88");
    expect(inv).toHaveTextContent("INV/2026-27/0001");
    expect(inv).toHaveTextContent("10,500.00 Dr");
    expect(rec).toHaveTextContent("By Kotak Mahindra Bank");
    expect(rec).toHaveTextContent("Receipt");
    expect(within(ledger).getByText("Current Total").closest("tr")).toHaveTextContent("10,500.0010,575.00");
    expect(within(ledger).getByText("Closing Balance").closest("tr")).toHaveTextContent("75.00 Cr");
    // Condensed: no breakup.
    expect(within(ledger).queryByText("Output CGST")).not.toBeInTheDocument();
  });

  it("shows a bounced cheque, entered and returned, without counting it", async () => {
    wrap();
    await userEvent.click(screen.getByRole("button", { name: "Sunrise Garments" }));
    const ledger = screen.getByRole("table", { name: "Ledger account" });
    const entered = within(ledger).getByRole("row", { name: "Cheque 004512 (bounced), not counted" });
    const returned = within(ledger).getByRole("row", { name: "Cheque 004512 returned, not counted" });
    expect(entered).toHaveTextContent("Indian Bank · ₹450.00 · not counted");
    expect(entered).not.toHaveTextContent(/^.*By Cheque/);
    expect(returned).toHaveTextContent("Bounced");
    expect(returned).toHaveTextContent("₹450.00 · Insufficient funds");
    for (const row of [entered, returned]) {
      const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
      // Debit and Credit empty; the balance as it stood.
      expect(cells.slice(4)).toEqual(["", "", "450.00 Dr"]);
    }
    expect(within(ledger).getByText("Current Total").closest("tr")).toHaveTextContent("10,500.0010,575.00");
  });

  it("adds each voucher's ledgers and the bills it settled in the detailed view, and prints it so", async () => {
    wrap("/accounts/statements?partyType=customer&party=c1");
    await userEvent.click(screen.getByRole("button", { name: "Detailed" }));
    const ledger = screen.getByRole("table", { name: "Ledger account" });
    expect(within(ledger).getByText("Output CGST")).toBeInTheDocument();
    expect(within(ledger).getByText("Bank Charges")).toBeInTheDocument();
    expect(within(ledger).getByText("INV/2026-27/0001", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PDF/ })).toHaveAttribute("href", expect.stringContaining("detailed=1"));
    expect(screen.getByRole("link", { name: /Excel/ })).toHaveAttribute("href", expect.stringContaining("/accounts/statement/xlsx"));
  });
});
