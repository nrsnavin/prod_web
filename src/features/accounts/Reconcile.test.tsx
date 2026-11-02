import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReconcileView } from "./BankStatementTab";
import type { Reconciliation } from "./types";

// The reconciliation reads as the accountant would write it, says when
// it is reconciled, and ticks a presented cheque cleared.

const rec: Reconciliation = {
  account: { _id: "a1", name: "Kotak" }, asOf: "2026-07-31",
  bookBalance: 104200,
  uncleared: [{ voucherType: "Payment", _id: "p1", number: "PAY/2026-27/0002", date: "2026-07-07", party: "Landlord", reference: "CHQ 77", direction: "out", amount: 6300 }],
  unmatched: [{ statement: "s1", index: 1, date: "2026-07-08", narration: "SMS CHARGES", ref: "", amount: 50, direction: "out" }],
  totals: { unclearedIn: 0, unclearedOut: 6300, unmatchedIn: 0, unmatchedOut: 50 },
  expectedBankBalance: 110450, bankBalance: 110450, bankBalanceFrom: { statement: "s1", file: "kotak.csv", to: "2026-07-08" }, difference: 0,
};
const clearEntry = vi.fn().mockResolvedValue({ success: true });
vi.mock("./api", () => ({ accountsService: { reconciliation: () => Promise.resolve(rec), clearEntry: (b: unknown) => clearEntry(b) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("the reconciliation", () => {
  it("explains the bank's balance and ticks a cheque cleared", async () => {
    render(<QueryClientProvider client={new QueryClient()}><ReconcileView account="a1" /></QueryClientProvider>);
    const sheet = await screen.findByLabelText("Reconciliation");
    expect(sheet).toHaveTextContent("Balance in the books₹1,04,200.00");
    expect(sheet).toHaveTextContent("Add payments the bank has not shown+ ₹6,300.00");
    expect(sheet).toHaveTextContent("The bank should show₹1,10,450.00");
    expect(screen.getByText("Reconciled")).toBeInTheDocument();
    expect(screen.getByText("SMS CHARGES")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cleared" }));
    expect(clearEntry).toHaveBeenCalledWith(expect.objectContaining({ voucherType: "Payment", id: "p1", account: "a1" }));
  });
});
