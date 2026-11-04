import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatutoryTab } from "./StatutoryTab";
import { JournalForm } from "./JournalForm";
import type { Gstr1, Gstr2bSummary, ItcReversalMonth, MsmeDues, MsmeYearEnd, PayrollBooks, TdsRegister } from "./types";

// The statutory tab: MSME dues with days left, GSTR-1 tables with the
// preparer's checks, the GSTR-2B position after an upload, and the
// Rule 37 list with a button that records the reversal. The journal
// form refuses to post until debits equal credits and a reason is given.

const msme: MsmeDues = {
  rows: [{ docType: "SupplierBill", id: "b1", docNo: "PB/2026-27/0007", refNo: "SD/77", date: "2026-10-01", amount: 10500, outstanding: 10500, party: "s1", partyName: "Sri Dyers", category: "micro", udyam: "UDYAM-TN-28-0001234", days: 15, dueDate: "2026-10-16", daysLeft: -19, state: "overdue" }],
  totals: { count: 1, outstanding: 10500, overdue: 10500, overdueCount: 1, dueSoon: 0 }, suppliers: 2,
};
const yearEnd: MsmeYearEnd = { fy: "2026-27", rows: [], totals: { allowed: 50000, late: 10000, disallowed: 10500 } };
const gstr1: Gstr1 = {
  month: "2026-10", fp: "102026", gstin: "33AAECB1234F1Z5", hsnDigits: 4,
  b2b: [{ ctin: "33AAEPS1001F1Z2", name: "Sunrise Garments", inv: [{ inum: "INV/2026-27/0001", idt: "05-10-2026", val: 10500, pos: "33", itms: [{ num: 1, itm_det: { rt: 5, txval: 10000, iamt: 0, camt: 250, samt: 250, csamt: 0 } }] }] }],
  b2cl: [], b2cs: [], exp: [], cdnr: [], cdnur: [], hsn: [{ num: 1, hsn_sc: "5806", desc: "20mm", uqc: "MTR", qty: 1000, rt: 5, txval: 10000, iamt: 0, camt: 250, samt: 250 }],
  docs: [{ doc_num: 1, doc_typ: "Invoices for outward supply", docs: [{ from: "INV/2026-27/0001", to: "INV/2026-27/0001", totnum: 1, cancel: 0, net_issue: 1 }] }],
  summary: { b2b: { count: 1, val: 10500, txval: 10000, tax: 500 }, b2cl: { count: 0, val: 0, txval: 0, tax: 0 }, exp: { count: 0, val: 0, txval: 0, tax: 0 }, b2cs: { count: 0, val: 0, txval: 0, tax: 0 }, cdnr: { count: 0, val: 0, txval: 0, tax: 0 }, cdnur: { count: 0, val: 0, txval: 0, tax: 0 } },
  checks: [{ level: "error", doc: "INV/2026-27/0002", text: "Kumar Knits has GSTIN 33AAEPS1002F1Z2 on file but the invoice carries none: it would go as B2C" }],
  counts: { invoices: 2, cancelled: 0, notes: 0 },
};
const gstr2b: Gstr2bSummary = {
  period: "2026-10", uploaded: true, uploadedAt: "2026-11-12T05:00:00Z",
  counts: { entries: 2, matched: 1, mismatch: 0, notInBooks: 1, missing: 1 }, itc: { matched: 500, mismatch: 0, notInBooks: 180, missing: 500, unavailable: 0 },
  rows: [
    { _id: "e1", kind: "invoice", supplierGstin: "33AAAPS0001F1Z5", supplierName: "Sri Dyers", number: "SD/77", date: "2026-10-03", value: 10500, taxable: 10000, tax: 500, cgst: 250, sgst: 250, igst: 0, itcAvailable: true, reason: "", match: { status: "matched", docType: "SupplierBill", doc: "b1", docNo: "PB/2026-27/0007", by: "number" } },
    { _id: "e2", kind: "invoice", supplierGstin: "33AAAPS0002F1Z5", supplierName: "Someone Else", number: "X/9", date: "2026-10-09", value: 1180, taxable: 1000, tax: 180, cgst: 90, sgst: 90, igst: 0, itcAvailable: true, reason: "", match: { status: "notInBooks" } },
  ],
  missing: [{ _id: "b2", billNo: "PB/2026-27/0008", supplierBillNo: "SD/78", supplierName: "Sri Dyers", supplierGstin: "33AAAPS0001F1Z5", billDate: "2026-10-20", tax: 500, grand: 10500, note: "Not in GSTR-2B" }],
};
const rule37: ItcReversalMonth = {
  month: "2026-10",
  toReverse: [{ _id: "b3", billNo: "PB/2026-27/0002", supplierBillNo: "SY/1", supplierName: "Sri Yarn", billDate: "2026-04-01", day180: "2026-09-28", overdueDays: 3, grand: 21000, outstanding: 10500, itc: 1000, reverse: 500, inMonth: true }],
  toReclaim: [], totals: { reverse: 500, reclaim: 0, reversed: 0, reclaimed: 0 }, done: { reversed: [], reclaimed: [] },
};
const itcReverse = vi.fn().mockResolvedValue({ success: true, billNo: "PB/2026-27/0002", amount: 500 });
const tdsRegister: TdsRegister = {
  month: "2026-10", due: "2026-11-07",
  rows: [{ section: "194C", deducted: 1000, count: 2, deposited: 0, interestPaid: 0, balance: 1000, interestDue: 15, late: true, challans: [] }],
  totals: { deducted: 1000, deposited: 0, balance: 1000, interestDue: 15 }, vouchers: [],
};
const addTdsChallan = vi.fn().mockResolvedValue({ success: true, register: { ...tdsRegister, rows: [{ ...tdsRegister.rows[0], deposited: 1000, balance: 0, interestDue: 0, late: false, challans: [{ _id: "c1", amount: 1000, interest: 15, bsrCode: "0510308", challanNo: "00412", depositedOn: "2026-11-10" }] }], totals: { deducted: 1000, deposited: 1000, balance: 0, interestDue: 0 } } });
const payrollBooks: PayrollBooks = {
  month: "2026-10", drafts: 0, paid: 17100,
  totals: { people: 2, gross: 35000, bonuses: 500, pf: 4200, esi: 150, advances: 500, other: 350, net: 30300, expense: 35150 },
  journals: { salary: null, paid: null, salaryStale: false, paidStale: false },
  statutory: { due: "2026-11-15", pf: { due: 4200, deposited: 0, late: false, rows: [] }, esi: { due: 150, deposited: 150, late: false, rows: [] }, pt: { deposited: 0, rows: [] } },
};
const postedPayroll: PayrollBooks = { ...payrollBooks, journals: { ...payrollBooks.journals, salary: { _id: "j1", journalNo: "JV/2026-27/0003", date: "2026-10-31", total: 35150 } } };
// The section refetches the month after posting, so the mock has to remember the post.
let payrollNow: PayrollBooks = payrollBooks;
const postPayrollSalary = vi.fn().mockImplementation(async () => { payrollNow = postedPayroll; return { success: true, journal: { journalNo: "JV/2026-27/0003" }, summary: postedPayroll }; });
const createJournal = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    msme: async () => msme, msmeYearEnd: async () => yearEnd, msmeForm1Url: () => "/api/v2/accounts/msme/form1?format=xlsx",
    gstr1: async () => gstr1, gstr1JsonUrl: (m: string) => `/api/v2/accounts/gstr1/json?month=${m}`, gstr1XlsxUrl: (m: string) => `/api/v2/accounts/gstr1/xlsx?month=${m}`,
    gstr2b: async () => gstr2b, itcReversal: async () => rule37, itcReverse: (...a: unknown[]) => itcReverse(...a),
    tdsRegister: async () => tdsRegister, addTdsChallan: (...a: unknown[]) => addTdsChallan(...a),
    payrollBooks: async () => payrollNow, postPayrollSalary: (...a: unknown[]) => postPayrollSalary(...a),
  },
}));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useAccountsMutations: () => ({ createJournal: { mutate: createJournal, isPending: false } }),
  useBankAccounts: () => ({ data: [{ _id: "a1", name: "Kotak CA", kind: "bank" }] }),
  useCategories: () => ({ data: [{ _id: "c1", name: "Rent" }] }),
  useOpenDocs: () => ({ data: { docs: [], balance: 0 } }),
}));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("the statutory tab", () => {
  it("lists MSME dues with days past the limit and the year-end position", async () => {
    wrap(<StatutoryTab />);
    const table = await screen.findByRole("table", { name: "MSME dues" });
    expect(within(table).getByText("Sri Dyers")).toBeInTheDocument();
    expect(within(table).getByText("19d late")).toBeInTheDocument();
    expect(screen.getByText(/1 past the limit, ₹10,500.00/)).toBeInTheDocument();
    expect(screen.getByText("Disallowed at year end").nextSibling).toHaveTextContent("₹10,500.00");
    expect(screen.getByRole("link", { name: /MSME Form I/ })).toHaveAttribute("href", expect.stringContaining("form1"));
  });

  it("shows GSTR-1 tables with the preparer's checks and the downloads", async () => {
    wrap(<StatutoryTab />);
    await userEvent.click(screen.getByRole("button", { name: "GSTR-1" }));
    expect(await screen.findByText(/2 invoices, 0 notes · HSN at 4 digits/)).toBeInTheDocument();
    const summary = screen.getByRole("table", { name: "GSTR-1 summary" });
    expect(within(summary).getByText("4 · B2B (registered, SEZ, deemed export)").closest("tr")).toHaveTextContent("10,000.00500.0010,500.00");
    expect(screen.getByLabelText("GSTR-1 checks")).toHaveTextContent("1 to fix before filing");
    expect(screen.getByLabelText("GSTR-1 checks")).toHaveTextContent("Kumar Knits has GSTIN");
    expect(screen.getByRole("link", { name: /JSON for the offline tool/ })).toHaveAttribute("href", "/api/v2/accounts/gstr1/json?month=2026-10");
    await userEvent.click(screen.getByRole("button", { name: "HSN summary" }));
    expect(within(screen.getByRole("table", { name: "HSN summary" })).getByText("5806")).toBeInTheDocument();
  });

  it("shows the GSTR-2B position and the bills the supplier did not report", async () => {
    wrap(<StatutoryTab />);
    await userEvent.click(screen.getByRole("button", { name: "GSTR-2B" }));
    const pos = await screen.findByLabelText("GSTR-2B position");
    expect(pos).toHaveTextContent("Matched1 · ITC ₹500.00");
    expect(pos).toHaveTextContent("Ours, not in 2B (ITC held)1 · ₹500.00");
    const lines = screen.getByRole("table", { name: "GSTR-2B lines" });
    expect(within(lines).getByText("matched")).toBeInTheDocument();
    expect(within(lines).getByText("not in books")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ours, not in 2B 1/ }));
    expect(within(screen.getByRole("table", { name: "Bills not in GSTR-2B" })).getByText("PB/2026-27/0008")).toBeInTheDocument();
  });

  it("lists the credit to reverse under Rule 37 and records it", async () => {
    wrap(<StatutoryTab />);
    await userEvent.click(screen.getByRole("button", { name: "ITC unpaid 180 days" }));
    const table = await screen.findByRole("table", { name: "ITC to reverse" });
    expect(within(table).getByText("PB/2026-27/0002").closest("tr")).toHaveTextContent("500.00");
    await userEvent.click(screen.getByRole("button", { name: "Record reversal" }));
    expect(itcReverse).toHaveBeenCalledWith("b3", "2026-10");
  });
});

describe("TDS and payroll on the statutory tab", () => {
  it("shows the deposit register with the due day and records a challan", async () => {
    wrap(<StatutoryTab />);
    await userEvent.click(screen.getByRole("button", { name: "TDS" }));
    expect(await screen.findByText(/deposit by 7 Nov 2026/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "TDS register" });
    expect(within(table).getByText("194C").closest("tr")).toHaveTextContent("1,000.00");
    expect(screen.getByText(/₹1,000.00 still to deposit, interest running ₹15.00/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Amount"), "1000");
    await userEvent.type(screen.getByLabelText("Deposited on"), "2026-11-10");
    await userEvent.click(screen.getByRole("button", { name: "Record challan" }));
    expect(addTdsChallan).toHaveBeenCalledWith(expect.objectContaining({ month: "2026-10", section: "194C", amount: 1000, depositedOn: "2026-11-10" }));
    expect(await screen.findByText(/0510308\/00412/)).toBeInTheDocument();
  });

  it("totals the payroll month and posts the salary journal", async () => {
    wrap(<StatutoryTab />);
    await userEvent.click(screen.getByRole("button", { name: "Payroll" }));
    const table = await screen.findByRole("table", { name: "Payroll month" });
    expect(within(table).getByText("Salaries & Wages (expense)").closest("tr")).toHaveTextContent("35,150.00");
    expect(within(table).getByText("Salary payable (net)").closest("tr")).toHaveTextContent("30,300.00");
    expect(screen.getByText(/PF and ESI · due by 15 Nov 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Post salary journal/ }));
    expect(postPayrollSalary).toHaveBeenCalledWith("2026-10");
    expect(await screen.findByText(/JV\/2026-27\/0003/)).toBeInTheDocument();
  });

  it("opens on the section and month the link asks for", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/accounts/statutory?section=payroll&month=2026-10"]}><StatutoryTab /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("table", { name: "Payroll month" })).toBeInTheDocument();
    expect(screen.getByLabelText("Month")).toHaveValue("2026-10");
  });
});

describe("the journal form", () => {
  it("posts only when debits equal credits and a reason is given", async () => {
    const onDone = vi.fn();
    wrap(<JournalForm onDone={onDone} onCancel={() => {}} />);
    const post = screen.getByRole("button", { name: "Post journal" });
    expect(post).toBeDisabled();
    // Line 1: a Tally ledger debited; line 2: a bank account credited.
    await userEvent.selectOptions(screen.getByLabelText("Line 1"), "ledger");
    await userEvent.type(screen.getAllByLabelText("Ledger, as named in Tally")[0], "Depreciation");
    await userEvent.type(screen.getAllByLabelText("Debit")[0], "5000");
    await userEvent.selectOptions(screen.getByLabelText("Line 2"), "bank");
    await userEvent.selectOptions(screen.getByLabelText("Account"), "a1");
    await userEvent.type(screen.getAllByLabelText("Credit")[1], "4000");
    expect(screen.getByText("off by ₹1,000.00")).toBeInTheDocument();
    await userEvent.clear(screen.getAllByLabelText("Credit")[1]);
    await userEvent.type(screen.getAllByLabelText("Credit")[1], "5000");
    expect(screen.getByText("balanced")).toBeInTheDocument();
    expect(post).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Reason *"), "Year-end depreciation on looms");
    expect(post).toBeEnabled();
    await userEvent.click(post);
    expect(createJournal).toHaveBeenCalledWith(expect.objectContaining({
      reason: "Year-end depreciation on looms",
      lines: [expect.objectContaining({ kind: "ledger", ledger: "Depreciation", debit: 5000, credit: 0 }), expect.objectContaining({ kind: "bank", account: "a1", debit: 0, credit: 5000 })],
    }), expect.anything());
  });
});
