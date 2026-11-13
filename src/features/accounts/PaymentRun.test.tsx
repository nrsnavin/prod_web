import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentRunTab } from "./PaymentRunTab";
import type { PaymentRunProposal, RunLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  PAY THIS WEEK
//
//  The run as proposed, in order, with why; the money it was worked out
//  on; suppliers held back with the reason. The proposal's own lines are
//  ticked; a held supplier whose account changed can be ticked with a
//  note of how it was confirmed, one with no account cannot. Pay asks
//  first, then sends the ticked suppliers with a request id.
// ══════════════════════════════════════════════════════════════════

const paymentRun = vi.fn();
const payRun = vi.fn();
const paymentRuns = vi.fn();
vi.mock("./api", () => ({ accountsService: {
  paymentRun: (...a: unknown[]) => paymentRun(...a), payRun: (...a: unknown[]) => payRun(...a), paymentRuns: (...a: unknown[]) => paymentRuns(...a),
} }));
vi.mock("./hooks", () => ({ ACCOUNTS_KEY: "accounts" }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const doc = (over: Partial<RunLine["docs"][number]>): RunLine["docs"][number] => ({ docType: "SupplierBill", id: "b1", docNo: "PB/2026-27/0001", refNo: "MC/40", date: "2026-10-04", dueDate: "2026-11-18", party: "s1", partyName: "Murugan Covering Works", outstanding: 105000, tds: 0, section: "", cash: 105000, priority: "msme", why: "x", ...over });
const line = (over: Partial<RunLine>): RunLine => ({ supplier: "s1", supplierName: "Murugan Covering Works", msme: null, priority: "due", why: "Due on 18 Nov", docs: [doc({})], gross: 105000, tds: 0, cash: 105000, notes: [], ...over });

const proposal = (over: Partial<PaymentRunProposal> = {}): PaymentRunProposal => ({
  asOf: "2026-11-13T00:00:00.000Z", horizon: 7, until: "2026-11-20T00:00:00.000Z",
  cash: {
    bank: 1000000, accounts: [{ _id: "acc1", name: "Kotak CA", balance: 1000000, isDefault: true }], payFrom: { _id: "acc1", name: "Kotak CA", balance: 1000000 },
    commitments: [{ party: "Salaries", docNo: "Salaries Oct", amount: 300000, date: "2026-11-15T00:00:00.000Z", basis: "estimate: October payroll, 40 people" }],
    committed: 300000, receipts: 120000, useReceipts: false, cushion: 0, spendable: 700000, budget: null, limit: 700000, forecastError: "", proposed: 156500, left: 543500,
  },
  lines: [
    line({ msme: "micro", priority: "msme", why: "Micro enterprise: its 45 days under the MSMED Act run out on 18 Nov. Paid later, interest runs at three times the bank rate, and unpaid at 31 March the bill is not an expense of the year" }),
    line({ supplier: "s2", supplierName: "Sri Yarn Traders", priority: "overdue", why: "Due on 29 Oct: 15 days overdue", gross: 52500, tds: 1000, cash: 51500, docs: [doc({ id: "b2", docNo: "PB/2026-27/0002", refNo: "SY/77", party: "s2", outstanding: 52500, tds: 1000, section: "194C", cash: 51500, priority: "overdue" })], notes: ["They have ₹5,000 on account (1 advance or note): set it against their bills first, and pay less"] }),
  ],
  held: [
    line({ supplier: "s3", supplierName: "Velan Spares", priority: "overdue", why: "Due on 3 Nov: 10 days overdue", cash: 8400, gross: 8400, docs: [doc({ id: "b3", party: "s3", outstanding: 8400, cash: 8400 })], holds: [{ code: "BANK_CHANGED", severity: "confirm", message: "Their bank account changed on 10 Nov (by Meena), from …5544 to …1235: call them on the number on file before paying" }] }),
    line({ supplier: "s4", supplierName: "Anand Tapes", priority: "overdue", why: "Due on 3 Nov", cash: 4200, gross: 4200, docs: [doc({ id: "b4", party: "s4", outstanding: 4200, cash: 4200 })], holds: [{ code: "NO_BANK", severity: "danger", message: "No bank account on file: pay them by cheque from the payment form, or add their account" }] }),
  ],
  short: [line({ supplier: "s5", supplierName: "Kumar Dyes", priority: "due", cash: 21000, gross: 21000, docs: [doc({ id: "b5", party: "s5", outstanding: 21000, cash: 21000, priority: "due", reason: "cash" })] })],
  msmeShort: 0, later: { count: 1, amount: 10500 },
  totals: { suppliers: 2, docs: 2, gross: 157500, tds: 1000, cash: 156500 },
  ...over,
});

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><PaymentRunTab /></MemoryRouter></QueryClientProvider>);

beforeEach(() => {
  for (const f of [paymentRun, payRun, paymentRuns]) f.mockReset();
  paymentRun.mockResolvedValue(proposal());
  paymentRuns.mockResolvedValue([]);
  payRun.mockResolvedValue({ success: true, run: { _id: "r1", requestId: "x", date: "2026-11-13", accountName: "Kotak CA", status: "partly_paid", createdByName: "Owner", createdAt: "2026-11-13T05:00:00Z",
    totals: { suppliers: 3, paid: 2, failed: 1, cash: 113900, tds: 1000 },
    lines: [
      { supplier: "s2", supplierName: "Sri Yarn Traders", cash: 51500, tds: 1000, status: "paid", payment: "p2", voucherNo: "PAY/2026-27/0040", error: "" },
      { supplier: "s3", supplierName: "Velan Spares", cash: 8400, tds: 0, status: "paid", payment: "p3", voucherNo: "PAY/2026-27/0041", error: "" },
      { supplier: "s5", supplierName: "Kumar Dyes", cash: 21000, tds: 0, status: "failed", payment: null, voucherNo: "", error: "Allocation 1: PB/2026-27/0005 is not open" },
    ] } });
});

describe("pay this week", () => {
  it("shows the run in order with why, the money it was worked out on, and who is held back and why", async () => {
    wrap();
    const toPay = await screen.findByLabelText("To pay");
    const rows = within(toPay).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Murugan Covering Works");
    expect(rows[0]).toHaveTextContent("MSME days");
    expect(rows[0]).toHaveTextContent("its 45 days under the MSMED Act run out on 18 Nov");
    expect(rows[1]).toHaveTextContent("Sri Yarn Traders");
    expect(rows[1]).toHaveTextContent("of ₹52,500.00, TDS ₹1,000.00");
    expect(rows[1]).toHaveTextContent("set it against their bills first");
    expect(within(toPay).getByLabelText("Pay Murugan Covering Works")).toBeChecked();
    expect(within(toPay).getByLabelText("Pay Sri Yarn Traders")).toBeChecked();

    const money = screen.getByLabelText("Money for the run");
    expect(money).toHaveTextContent("In the bank₹10,00,000.00");
    expect(money).toHaveTextContent("Going out besides₹3,00,000.00");
    expect(money).toHaveTextContent("To spend₹7,00,000.00");
    expect(money).toHaveTextContent("Left₹5,43,500.00");
    await userEvent.click(within(money).getByRole("button", { name: /what else goes out/i }));
    expect(screen.getByLabelText("Going out besides")).toHaveTextContent("Salaries (estimate: October payroll, 40 people)");

    const held = screen.getByLabelText("Held back");
    expect(held).toHaveTextContent("call them on the number on file before paying");
    expect(within(held).getByLabelText("Pay Velan Spares")).not.toBeChecked();
    expect(within(held).getByLabelText("Pay Anand Tapes")).toBeDisabled();
    expect(screen.getByLabelText("Not this week")).toHaveTextContent("Not enough money this week");
    expect(screen.getByText(/1 more bill, ₹10,500.00, fall due after/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay 2 suppliers" })).toBeEnabled();
  });

  it("pays what is ticked, after asking: a changed account only with a note of how it was confirmed", async () => {
    wrap();
    const toPay = await screen.findByLabelText("To pay");
    await userEvent.click(within(toPay).getByLabelText("Pay Murugan Covering Works"));
    await userEvent.click(within(screen.getByLabelText("Held back")).getByLabelText("Pay Velan Spares"));
    await userEvent.click(within(screen.getByLabelText("Not this week")).getByLabelText("Pay Kumar Dyes"));
    const pay = screen.getByRole("button", { name: "Pay 3 suppliers" });
    expect(pay).toBeDisabled();
    expect(screen.getByText(/Say how you confirmed Velan Spares's bank account/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("How you confirmed Velan Spares's account"), "Called Velan on the number on file");
    expect(pay).toBeEnabled();
    await userEvent.click(pay);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("₹80,900.00 goes out of Kotak CA by bank transfer");
    expect(dialog).toHaveTextContent("TDS of ₹1,000.00 is kept back");
    await userEvent.click(within(dialog).getByRole("button", { name: "Pay ₹80,900.00" }));
    await waitFor(() => expect(payRun).toHaveBeenCalledTimes(1));
    expect(payRun.mock.calls[0][0]).toMatchObject({
      account: "acc1", suppliers: ["s2", "s3", "s5"], riskNotes: { s3: "Called Velan on the number on file" }, horizon: 7, requestId: expect.any(String),
    });
    const result = await screen.findByLabelText("The run as paid");
    expect(result).toHaveTextContent("Paid 2 of 3");
    expect(within(result).getByRole("link", { name: /PAY\/2026-27\/0040/ })).toHaveAttribute("href", "/accounts/payments/p2");
    expect(result).toHaveTextContent("PB/2026-27/0005 is not open");
  });

  it("too little for the micro supplier is said; what is kept back is asked of the server", async () => {
    paymentRun.mockResolvedValue(proposal({ lines: [], msmeShort: 5000, totals: { suppliers: 0, docs: 0, gross: 0, tds: 0, cash: 0 } }));
    wrap();
    expect(await screen.findByRole("alert")).toHaveTextContent("₹5,000.00 more is needed to pay the micro and small suppliers");
    expect(screen.getByLabelText("To pay")).toHaveTextContent("Nothing falls due by");
    expect(screen.getByRole("button", { name: "Pay 0 suppliers" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Keep back (₹)"), "50000");
    await waitFor(() => expect(paymentRun).toHaveBeenLastCalledWith(expect.objectContaining({ cushion: 50000, horizon: 7 })));
  });
});
