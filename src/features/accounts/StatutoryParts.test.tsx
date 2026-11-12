import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatutoryTab } from "./StatutoryTab";
import type { ItcReversalMonth, TdsRegister } from "./types";

// Rule 37 in parts: a bill paid in parts has its credit re-claimed in
// parts, and a bill re-claimed and then unpaid again (a payment was
// cancelled) is back among those to reverse, for the difference only.
// And the TDS register says what it does not carry: tax on bills booked
// and not yet paid, which the law treats as due when the bill is booked.

const rule37: ItcReversalMonth = {
  month: "2026-10",
  toReverse: [
    // Never reversed: the whole credit on the unpaid share.
    { _id: "b1", billNo: "PB/2026-27/0002", supplierBillNo: "SY/1", supplierName: "Sri Yarn", billDate: "2026-04-01", day180: "2026-09-28", overdueDays: 33, grand: 21000, outstanding: 10500, itc: 1000, reverse: 500, inMonth: false, reversed: 0, reclaimed: 0, again: false },
    // Reversed 1,000, all re-claimed when paid, and the payment was cancelled: unpaid again.
    { _id: "b2", billNo: "PB/2026-27/0003", supplierBillNo: "SY/2", supplierName: "Sri Yarn", billDate: "2026-04-02", day180: "2026-09-29", overdueDays: 32, grand: 21000, outstanding: 21000, itc: 1000, reverse: 1000, inMonth: false, reversed: 1000, reclaimed: 1000, again: true },
  ],
  toReclaim: [
    // Reversed 900, a third paid since and re-claimed; now another third is paid.
    { _id: "b3", billNo: "PB/2026-27/0004", supplierBillNo: "KD/9", supplierName: "Kovai Dyes", billDate: "2026-03-20", reversed: 900, reclaimed: 300, reversedPeriod: "2026-09", outstanding: 6300, reclaim: 300, fully: false },
  ],
  totals: { reverse: 1500, reclaim: 300, reversed: 0, reclaimed: 0 }, done: { reversed: [], reclaimed: [] },
};
const itcReverse = vi.fn();
const itcReclaim = vi.fn();
let tdsNow: TdsRegister;
const tdsRegister: TdsRegister = {
  month: "2026-10", due: "2026-11-07",
  rows: [{ section: "194C", deducted: 1000, count: 2, deposited: 1000, interestPaid: 0, balance: 0, interestDue: 0, late: false, challans: [] }],
  totals: { deducted: 1000, deposited: 1000, balance: 0, interestDue: 0 }, vouchers: [],
  notDeducted: {
    asOf: "2026-10-31T18:29:59.999Z", total: 2400, base: 150000,
    rows: [
      { _id: "t1", billNo: "PB/2026-27/0031", supplierBillNo: "JW/88", supplierName: "Anand Job Works", billDate: "2026-09-12", section: "194C", rate: 1, unpaid: 118000, base: 100000, tds: 1000, month: "2026-09" },
      { _id: "t2", billNo: "PB/2026-27/0040", supplierBillNo: "", supplierName: "Mani & Co", billDate: "2026-10-20", section: "194J", rate: 10, unpaid: 16520, base: 14000, tds: 1400, month: "2026-10" },
    ],
  },
};
vi.mock("./api", () => ({
  accountsService: {
    msme: async () => ({ rows: [], totals: { count: 0, outstanding: 0, overdue: 0, overdueCount: 0, dueSoon: 0 }, suppliers: 0 }),
    msmeYearEnd: async () => ({ fy: "2026-27", rows: [], totals: { allowed: 0, late: 0, disallowed: 0 } }), msmeForm1Url: () => "#",
    itcReversal: async () => rule37, itcReverse: (...a: unknown[]) => itcReverse(...a), itcReclaim: (...a: unknown[]) => itcReclaim(...a),
    tdsRegister: async () => tdsNow,
  },
}));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useAccountsMutations: () => ({}),
  useBankAccounts: () => ({ data: [{ _id: "a1", name: "Kotak CA", kind: "bank" }] }),
  useCategories: () => ({ data: [] }),
  useOpenDocs: () => ({ data: { docs: [], balance: 0 } }),
}));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const open = (section: string) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/accounts/statutory?section=${section}&month=2026-10`]}><StatutoryTab /></MemoryRouter></QueryClientProvider>);

beforeEach(() => { itcReverse.mockReset(); itcReclaim.mockReset(); toast.mockReset(); tdsNow = tdsRegister; });

describe("Rule 37, a bill paid in parts", () => {
  it("shows what stands reversed beside the next step, and marks a bill unpaid again", async () => {
    open("rule37");
    const table = await screen.findByRole("table", { name: "ITC to reverse" });
    const first = within(table).getByText("PB/2026-27/0002").closest("tr")!;
    expect(first).toHaveTextContent("500.00");
    expect(first).not.toHaveTextContent("so far");
    const again = within(table).getByText("PB/2026-27/0003").closest("tr")!;
    expect(again).toHaveTextContent("unpaid again · 1,000.00 reversed, 1,000.00 re-claimed so far");
  });

  it("re-claims the share paid since, and says what is left reversed", async () => {
    itcReclaim.mockResolvedValue({ success: true, billNo: "PB/2026-27/0004", amount: 300, period: "2026-10", reversed: 900, reclaimed: 600 });
    open("rule37");
    const table = await screen.findByRole("table", { name: "ITC to re-claim" });
    const row = within(table).getByText("PB/2026-27/0004").closest("tr")!;
    expect(row).toHaveTextContent("reversed ₹900.00 in 2026-09 · ₹300.00 re-claimed so far · ₹6,300.00 still unpaid, its credit stays reversed");
    expect(row).toHaveTextContent("re-claim 300.00");
    await userEvent.click(within(row).getByRole("button", { name: "Record re-claim" }));
    expect(itcReclaim).toHaveBeenCalledWith("b3", "2026-10");
    await waitFor(() => expect(toast).toHaveBeenCalledWith("PB/2026-27/0004: ₹300.00 re-claimed in October 2026 · ₹300.00 stands reversed", "success"));
  });

  it("says when nothing is left reversed", async () => {
    itcReclaim.mockResolvedValue({ success: true, billNo: "PB/2026-27/0004", amount: 600, period: "2026-10", reversed: 900, reclaimed: 900 });
    open("rule37");
    const table = await screen.findByRole("table", { name: "ITC to re-claim" });
    await userEvent.click(within(table).getByRole("button", { name: "Record re-claim" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("PB/2026-27/0004: ₹600.00 re-claimed in October 2026 · nothing left reversed", "success"));
  });

  it("an older server's answer, without the running totals, still reads", async () => {
    itcReverse.mockResolvedValue({ success: true, billNo: "PB/2026-27/0002", amount: 500 });
    open("rule37");
    const table = await screen.findByRole("table", { name: "ITC to reverse" });
    await userEvent.click(within(within(table).getByText("PB/2026-27/0002").closest("tr")!).getByRole("button", { name: "Record reversal" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("PB/2026-27/0002: ₹500.00 reversed in October 2026", "success"));
  });
});

describe("TDS on bills booked and not yet paid", () => {
  it("is listed under the register, with the month each fell due", async () => {
    open("tds");
    const card = await screen.findByLabelText("TDS not yet deducted");
    expect(card).toHaveTextContent("Booked and not yet paid · ₹2,400.00 of TDS not deducted");
    expect(card).toHaveTextContent("2 bills of this year were still unpaid at the end of October 2026");
    const table = within(card).getByRole("table", { name: "Bills with TDS not deducted" });
    const job = within(table).getByText("PB/2026-27/0031").closest("tr")!;
    expect(job).toHaveTextContent("Anand Job Works");
    expect(job).toHaveTextContent("due for September 2026");
    expect(job).toHaveTextContent("194C · 1%");
    expect(job).toHaveTextContent("1,18,000.001,00,000.001,000.00");
    expect(within(table).getByRole("link", { name: "PB/2026-27/0040" })).toHaveAttribute("href", "/accounts/bills/t2");
  });

  it("is not shown when every such bill is paid, or the server does not send it", async () => {
    tdsNow = { ...tdsRegister, notDeducted: { asOf: "2026-10-31T18:29:59.999Z", rows: [], total: 0, base: 0 } };
    const { unmount } = open("tds");
    expect(await screen.findByRole("table", { name: "TDS register" })).toBeInTheDocument();
    expect(screen.queryByLabelText("TDS not yet deducted")).not.toBeInTheDocument();
    unmount();
    const { notDeducted: _gone, ...older } = tdsRegister;
    tdsNow = older;
    open("tds");
    expect(await screen.findByRole("table", { name: "TDS register" })).toBeInTheDocument();
    expect(screen.queryByLabelText("TDS not yet deducted")).not.toBeInTheDocument();
  });
});
