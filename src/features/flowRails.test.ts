import { describe, expect, it } from "vitest";
import { orderSteps } from "./orders/OrderRail";
import { invoiceSteps } from "./invoices/InvoiceRail";
import { stockCountSteps } from "./stockCounts/StockCountRail";
import { monthEndSteps } from "./accounts/MonthEndRail";
import { payrollSteps } from "./hr/PayrollRail";
import type { OrderDetail } from "./orders/types";
import type { Invoice, InvoiceSummary } from "./invoices/types";
import type { StockCount } from "./stockCounts/types";

// ══════════════════════════════════════════════════════════════════
//  THE FIVE RAILS READ THE RECORD, NOT A BUTTON
//
//  Each step's state comes from the figures: metres made and sent,
//  invoices and what came in, lines counted, the close checklist, slips
//  and journals. These pin what each rail says at the points that matter.
// ══════════════════════════════════════════════════════════════════

const states = (s: { key: string; state: string }[]) => Object.fromEntries(s.map((x) => [x.key, x.state]));
const detail = (s: { key: string; detail?: unknown }[], key: string) => s.find((x) => x.key === key)?.detail;

describe("the order rail", () => {
  const el = (over = {}) => ({
    id: "e1", name: "20mm", ordered: 14000, produced: 3500, packed: 0, delivered: 0,
    undelivered: 14000, notAssigned: 0, pendingDelivery: 14000, pending: 0, ...over,
  });
  const order = (over: Partial<OrderDetail> = {}) =>
    ({ status: "InProgress", elastics: [el()], jobs: [{ job: { _id: "j1", status: "weaving" } }], ...over }) as OrderDetail;
  const inv = (over: Partial<InvoiceSummary> = {}) =>
    ({ _id: "i1", invoiceNumber: "INV-1", invoiceDate: "2026-07-12", status: "issued", totals: { grand: 10000 }, paidAmount: 0, ...over }) as InvoiceSummary;

  it("an Open order waits for approval", () => {
    const s = orderSteps(order({ status: "Open", jobs: [] }));
    expect(states(s).approved).toBe("current");
    expect(detail(s, "approved")).toBe("Waiting for approval");
  });

  it("stands at production while the metres are being made, and says how far", () => {
    const s = orderSteps(order());
    expect(states(s)).toMatchObject({ approved: "done", looms: "done", produced: "current", packed: "todo" });
    expect(detail(s, "produced")).toBe("3,500 of 14,000 m");
  });

  it("is not on the looms while metres are left out of every job", () => {
    const s = orderSteps(order({ elastics: [el({ notAssigned: 4000 })] }));
    expect(states(s).looms).toBe("current");
    expect(detail(s, "looms")).toBe("4,000 m not in a job");
  });

  it("a cancelled job does not count as planning", () => {
    const s = orderSteps(order({ jobs: [{ job: { _id: "j1", status: "cancelled" } }] }));
    expect(detail(s, "looms")).toBe("No jobs yet");
  });

  it("adds billing and payment for someone who can see the invoices", () => {
    const sent = order({ elastics: [el({ produced: 14000, packed: 14000, delivered: 14000 })] });
    const s = orderSteps(sent, { invoices: [inv()], uninvoicedDcs: [], totals: { count: 1, cancelled: 0, invoiced: 10000, registered: 0 } });
    expect(states(s)).toMatchObject({ dispatched: "done", invoiced: "done", paid: "current" });
    expect(detail(s, "paid")).toBe("₹10,000 owed");
    const paid = orderSteps(sent, { invoices: [inv({ paidAmount: 10000 })], uninvoicedDcs: [] });
    expect(states(paid).paid).toBe("done");
  });

  it("a challan left off every invoice keeps it at invoicing", () => {
    const sent = order({ elastics: [el({ produced: 14000, packed: 14000, delivered: 14000 })] });
    const s = orderSteps(sent, { invoices: [inv()], uninvoicedDcs: [{ _id: "d", dcNumber: "D-2", totalQuantity: 400 }], totals: { count: 1, cancelled: 0, invoiced: 10000, registered: 0 } });
    expect(states(s).invoiced).toBe("current");
    expect(detail(s, "invoiced")).toBe("₹10,000 · 1 challan to invoice");
  });

  it("no money steps without the invoices (a production login)", () => {
    expect(orderSteps(order(), null).map((x) => x.key)).not.toContain("invoiced");
  });

  it("a completed order closed short skips what it never reached, and still waits on the money", () => {
    const s = orderSteps(order({ status: "Completed", elastics: [el({ produced: 13000, packed: 13000, delivered: 13000 })] }), { invoices: [], uninvoicedDcs: [] });
    expect(states(s)).toMatchObject({ produced: "skipped", dispatched: "skipped", invoiced: "current" });
    expect(detail(s, "dispatched")).toBe("13,000 of 14,000 m");
  });
});

describe("the invoice rail", () => {
  const base = {
    _id: "i1", invoiceNumber: "INV-1", invoiceDate: "2026-07-12", status: "issued",
    totals: { grand: 63000 }, einvoice: { status: "pending" }, einvoiceProblems: [],
  } as unknown as Invoice;

  it("stands at the IRN once nothing would be refused", () => {
    expect(states(invoiceSteps(base))).toMatchObject({ issued: "done", checked: "done", irn: "current", ewb: "todo", paid: "todo" });
  });

  it("stands at checking while the portal would refuse it", () => {
    const s = invoiceSteps({ ...base, einvoiceProblems: ["No PIN code", "No GSTIN"] });
    expect(states(s).checked).toBe("current");
    expect(detail(s, "checked")).toBe("2 things to fix");
  });

  it("skips the e-way bill at ₹50,000 or less", () => {
    const s = invoiceSteps({ ...base, totals: { ...base.totals, grand: 50000 }, einvoice: { status: "registered" } });
    expect(states(s)).toMatchObject({ ewb: "skipped", paid: "current" });
  });

  it("says what came in and what is owed", () => {
    const s = invoiceSteps({ ...base, einvoice: { status: "registered" }, ewaybill: { status: "generated", number: "EWB-1" }, paidAmount: 20000 });
    expect(states(s)).toMatchObject({ ewb: "done", paid: "current" });
    expect(detail(s, "ewb")).toBe("EWB-1");
    expect(detail(s, "paid")).toBe("₹20,000 in, ₹43,000 owed");
  });
});

describe("the stock count rail", () => {
  const totals = { lines: 10, counted: 6, uncounted: 4, varied: 2, needingReason: 1, gainQuantity: 0, lossQuantity: 0, gainValue: 0, lossValue: 0, netValue: 0 };
  const count = (over: Partial<StockCount> = {}) =>
    ({ status: "counting", frozenAt: "2026-11-01T00:00:00Z", postedAt: null, postedSummary: null, totals, ...over }) as StockCount;

  it("stands at counting while lines have no figure", () => {
    const s = stockCountSteps(count());
    expect(states(s)).toMatchObject({ opened: "done", counted: "current", reviewed: "todo" });
    expect(detail(s, "counted")).toBe("6 of 10 lines");
  });

  it("then at the differences while one still needs a reason", () => {
    const s = stockCountSteps(count({ status: "review", totals: { ...totals, counted: 10, uncounted: 0 } }));
    expect(states(s)).toMatchObject({ counted: "done", reviewed: "current" });
    expect(detail(s, "reviewed")).toBe("1 needs a reason");
  });

  it("then at posting", () => {
    const s = stockCountSteps(count({ status: "review", totals: { ...totals, counted: 10, uncounted: 0, needingReason: 0 } }));
    expect(states(s)).toMatchObject({ reviewed: "done", posted: "current" });
  });

  it("a posted count is done throughout, even one posted with lines left uncounted", () => {
    const s = stockCountSteps(count({ status: "posted", postedAt: "2026-11-03T00:00:00Z", postedSummary: { linesCounted: 8, linesVaried: 2, gainQuantity: 0, lossQuantity: 0, gainValue: 0, lossValue: 0, netValue: -1200, linesMovedSinceFreeze: 0 } }));
    expect(s.every((x) => x.state === "done")).toBe(true);
    expect(detail(s, "counted")).toBe("8 lines counted");
  });
});

describe("the month-end rail", () => {
  const item = (key: string, ok: boolean, d = `${key} detail`) => ({ key, ok, detail: d });
  const all = (over: Record<string, boolean> = {}) =>
    ["bank", "cleared", "photos", "approvals", "tds", "msme", "rule37", "credits", "gstr2b", "tally", "lock"].map((k) => item(k, over[k] ?? true));

  it("groups the checklist into the accountant's steps", () => {
    expect(states(monthEndSteps(all()))).toEqual({ bank: "done", checklist: "done", gst: "done", tally: "done", lock: "done" });
  });

  it("one open item names itself; several are counted", () => {
    const s = monthEndSteps(all({ cleared: false, photos: false, credits: false }));
    expect(states(s)).toMatchObject({ bank: "current", checklist: "todo" });
    expect(detail(s, "bank")).toBe("cleared detail");
    expect(detail(s, "checklist")).toBe("2 items left");
  });

  it("locking waits for Tally", () => {
    const s = monthEndSteps(all({ tally: false, lock: false }));
    expect(states(s)).toMatchObject({ tally: "current", lock: "todo" });
  });
});

describe("the payroll rail", () => {
  const summary = (over = {}) => ({
    totalEmployees: 42, totalNetPay: 0, totalGross: 0, totalDeductions: 0, totalBonuses: 0, perfectCount: 0,
    paidCount: 0, partiallyPaidCount: 0, finalizedCount: 0, draftCount: 42, ...over,
  });
  const nov = { year: 2026, month: 11 };
  const after = new Date(2026, 11, 2);

  it("waits for the month to end before anything", () => {
    const s = payrollSteps({ ...nov, summary: summary({ draftCount: 0 }), today: new Date(2026, 10, 20) });
    expect(states(s).ended).toBe("current");
    expect(detail(s, "ended")).toBe("1–30 Nov");
  });

  it("stands at checking while a draft slip has a flag", () => {
    const check = { summary: { slips: 42, high: 1, check: 1, info: 0, totalNet: 0, lastMonthNet: 0 }, rows: [
      { payrollId: "p1", employeeId: "e1", name: "A", status: "draft", netPay: 1, flags: [{ code: "x", severity: "high" as const, reason: "Pay up 40%" }] },
      { payrollId: "p2", employeeId: "e2", name: "B", status: "draft", netPay: 1, flags: [{ code: "y", severity: "info" as const, reason: "New joiner" }] },
    ] };
    const s = payrollSteps({ ...nov, summary: summary(), check, today: after });
    expect(states(s)).toMatchObject({ ended: "done", generated: "done", checked: "current", finalised: "todo" });
    expect(detail(s, "generated")).toBe("42 slips");
    expect(detail(s, "checked")).toBe("1 slip to review");
  });

  it("counts paid slips, and leaves out the books for someone outside Accounts", () => {
    const s = payrollSteps({ ...nov, summary: summary({ draftCount: 0, finalizedCount: 40, paidCount: 2 }), today: after });
    expect(states(s)).toMatchObject({ finalised: "done", paid: "current" });
    expect(detail(s, "paid")).toBe("2 of 42");
    expect(s.map((x) => x.key)).not.toContain("books");
  });

  it("is in the books once the salary journal and the payments are posted and current", () => {
    const journal = { _id: "j", journalNo: "JV-12", date: "2026-12-01", total: 1 };
    const books = (j: object) => ({ journals: { salary: journal, paid: journal, salaryStale: false, paidStale: false, ...j } }) as never;
    const paidAll = summary({ draftCount: 0, paidCount: 42 });
    expect(states(payrollSteps({ ...nov, summary: paidAll, books: books({}), today: after })).books).toBe("done");
    const stale = payrollSteps({ ...nov, summary: paidAll, books: books({ salaryStale: true }), today: after });
    expect(states(stale).books).toBe("current");
    expect(detail(stale, "books")).toBe("Salary journal out of date");
    expect(detail(payrollSteps({ ...nov, summary: paidAll, books: null, today: after }), "books")).toBe("Salary journal to post");
  });
});
