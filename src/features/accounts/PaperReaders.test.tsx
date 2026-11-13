import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NoteForm } from "./NotesTab";
import { StatutoryTab } from "./StatutoryTab";
import { PowerCost } from "./PowerCost";
import type { DebitNoteResult, Form16aResult, PowerBillResult, PowerCostRow, TdsChallanResult, TdsReceivable, TdsRegister } from "./types";

// ══════════════════════════════════════════════════════════════════
//  PAPERS READ INTO THE FORMS — phase 3
//
//  A customer's debit note fills the credit note against the invoice it
//  names; a TDS challan fills the challan form with the month it pays; a
//  Form 16A is confirmed and saved to certificates received; Form 26AS
//  as a PDF goes to the reader, not the CSV parser; the electricity bill
//  is kept for its month and power cost per metre is shown. Whatever is
//  saved from a read carries the read's id, so the read is scored.
// ══════════════════════════════════════════════════════════════════

const createNote = vi.fn();
const readDebitNote = vi.fn();
const readTdsPaper = vi.fn();
const read26asPdf = vi.fn();
const upload26as = vi.fn();
const addTdsChallan = vi.fn();
const addTdsCertificate = vi.fn();
const readPowerBill = vi.fn();
const savePowerBill = vi.fn();
let powerRows: PowerCostRow[] = [];

const register = (month: string): TdsRegister => ({
  month, due: "2026-12-07",
  rows: [{ section: "194C", deducted: 1000, count: 2, deposited: 0, interestPaid: 0, balance: 1000, interestDue: 0, late: false, challans: [] }],
  totals: { deducted: 1000, deposited: 0, balance: 1000, interestDue: 0 }, vouchers: [],
});
const receivable = { fy: "2026-27", rows: [{ customer: "c1", customerName: "Sunrise Garments", deducted: 500, certificates: 0, in26as: 0, short26as: 0, state: "no26as" }], totals: { deducted: 500, certificates: 0, in26as: 0 }, unmatched26as: 0 } as unknown as TdsReceivable;

vi.mock("./api", () => ({
  accountsService: {
    readDebitNote: (...a: unknown[]) => readDebitNote(...a),
    creditNoteLimit: async () => ({ invoiceNumber: "INV/2026-27/0701", limit: "2027-11-30", daysLeft: 380, past: false, soon: false }),
    readTdsPaper: (...a: unknown[]) => readTdsPaper(...a),
    read26asPdf: (...a: unknown[]) => read26asPdf(...a),
    upload26as: (...a: unknown[]) => upload26as(...a),
    addTdsChallan: (...a: unknown[]) => addTdsChallan(...a),
    addTdsCertificate: (...a: unknown[]) => addTdsCertificate(...a),
    tdsRegister: async (m: string) => register(m),
    tdsReceivable: async () => receivable,
    readPowerBill: (...a: unknown[]) => readPowerBill(...a),
    savePowerBill: (...a: unknown[]) => savePowerBill(...a),
    powerCost: async () => powerRows,
  },
}));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useAccountsMutations: () => ({ createNote: { mutate: createNote, isPending: false } }),
}));
// The party box shows the name it was handed; "pick party" chooses someone else.
vi.mock("./shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared")>();
  return { ...actual, PartyPicker: ({ value, knownName, onChange }: { value: string; knownName?: string; onChange: (id: string, name: string) => void }) => (
    <div><span data-testid="party">{knownName ?? value}</span><button type="button" onClick={() => onChange("c2", "Kumar Knits")}>pick party</button></div>
  ) };
});
// The customer's fifty latest invoices: the one their note names is older, so it is not among them.
vi.mock("@/features/invoices/api", () => ({ invoiceService: { list: async () => ({ invoices: [{ _id: "inv650", invoiceNumber: "INV/2026-27/0650", invoiceDate: "2026-10-01", totals: { grand: 1050 }, supplyType: "intra" }] }) } }));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const photo = () => new File(["x"], "paper.jpg", { type: "image/jpeg" });
const wrap = (ui: React.ReactNode, url = "/") => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter></QueryClientProvider>);

const debitNote = (over: Partial<DebitNoteResult> = {}): DebitNoteResult => ({
  read: { problem: null, kind: "debit_note", customerName: "SUNRISE GARMENTS PVT LTD", noteNo: "DN/112", date: "2026-11-08", invoices: ["701"], reason: "12 rolls short received", taxable: null, gst: null, total: 4200 },
  customer: { _id: "c1", name: "Sunrise Garments", matchedBy: "gstin" },
  invoice: { _id: "inv701", invoiceNumber: "INV/2026-27/0701", invoiceDate: "2026-09-01", grand: 52500, gstPercent: 5, supplyType: "intra", others: [] },
  notesSoFar: { notes: [], credited: 0, left: 52500 },
  draft: {
    kind: "credit", against: { docType: "Invoice", doc: "inv701", docNo: "INV/2026-27/0701" }, reason: "Their debit note DN/112: 12 rolls short received", partyNoteNo: "DN/112", financial: false,
    lines: [{ description: "12 rolls short received", quantity: 1, rate: 4000, gstPercent: 5 }], totals: { taxable: 4000, gst: 200, grand: 4200 }, basis: "its total less GST at 5%",
  },
  checks: [{ code: "SHORT_NO", severity: "info", message: "\"701\" taken as INV/2026-27/0701" }],
  aiSuggestion: "ai-dn-1",
  ...over,
});

beforeEach(() => {
  for (const f of [createNote, readDebitNote, readTdsPaper, read26asPdf, upload26as, addTdsChallan, addTdsCertificate, readPowerBill, savePowerBill]) f.mockReset();
  addTdsChallan.mockImplementation(async (b: { month: string }) => ({ success: true, register: register(b.month) }));
  addTdsCertificate.mockResolvedValue({ success: true, certificate: { _id: "t1" } });
  savePowerBill.mockResolvedValue({ _id: "pb1" });
  powerRows = [];
});

describe("a customer's debit note, into our credit note", () => {
  it("fills the customer, the invoice it names (older than the fifty listed), the reason, the line and their note number; issued, it carries the read", async () => {
    readDebitNote.mockResolvedValue(debitNote());
    wrap(<NoteForm form="credit" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /read the customer's debit note/i }));
    await userEvent.upload(screen.getByLabelText("Debit note photo"), photo());
    const said = await screen.findByLabelText("What the debit note says");
    expect(said).toHaveTextContent("Sunrise Garments");
    expect(said).toHaveTextContent("by GSTIN");
    expect(said).toHaveTextContent("INV/2026-27/0701");
    expect(said).toHaveTextContent("its total less GST at 5%");
    await userEvent.click(within(said).getByRole("button", { name: "Fill the credit note" }));

    expect(screen.getByTestId("party")).toHaveTextContent("Sunrise Garments");
    const against = screen.getByLabelText("Against invoice *") as HTMLSelectElement;
    await waitFor(() => expect(against).toHaveValue("inv701"));
    expect(within(against).getByRole("option", { name: /INV\/2026-27\/0701/ })).toBeInTheDocument();
    expect(within(against).getByRole("option", { name: /INV\/2026-27\/0650/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Reason *")).toHaveValue("Their debit note DN/112: 12 rolls short received");
    expect(screen.getByLabelText("Their debit note no.")).toHaveValue("DN/112");
    expect(screen.getByLabelText("Line 1 rate")).toHaveValue(4000);
    expect(screen.getByLabelText("Filled from their debit note")).toHaveTextContent("₹4,000.00 before GST (its total less GST at 5%)");

    await userEvent.click(screen.getByRole("button", { name: "Issue credit note" }));
    expect(readDebitNote).toHaveBeenCalledWith([expect.any(File)], undefined);
    expect(createNote).toHaveBeenCalledTimes(1);
    expect(createNote.mock.calls[0][0]).toMatchObject({
      kind: "credit", partyType: "customer", against: { doc: "inv701" }, partyNoteNo: "DN/112", debitNoteSuggestion: "ai-dn-1",
      reason: "Their debit note DN/112: 12 rolls short received", lines: [{ description: "12 rolls short received", quantity: 1, rate: 4000, gstPercent: 5 }],
    });
  });

  it("more than is open to credit: said before filling, and kept in sight on the form", async () => {
    readDebitNote.mockResolvedValue(debitNote({ checks: [{ code: "ROOM", severity: "danger", message: "₹60,000 is more than the ₹48,300 still open to credit on INV/2026-27/0701 (after CN/2026-27/0004)" }] }));
    wrap(<NoteForm form="credit" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /read the customer's debit note/i }));
    await userEvent.upload(screen.getByLabelText("Debit note photo"), photo());
    expect(await screen.findByLabelText("Checks on the debit note")).toHaveTextContent("still open to credit");
    await userEvent.click(screen.getByRole("button", { name: "Fill it in anyway" }));
    expect(screen.getByLabelText("Checks on their debit note")).toHaveTextContent("₹48,300 still open to credit");
  });

  it("a paper that is not a debit note fills nothing; another customer picked drops the invoice it named", async () => {
    readDebitNote.mockResolvedValueOnce({ ...debitNote(), read: { problem: "not_a_debit_note" }, customer: null, invoice: null, draft: null, checks: [] });
    wrap(<NoteForm form="credit" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /read the customer's debit note/i }));
    await userEvent.upload(screen.getByLabelText("Debit note photo"), photo());
    expect(await screen.findByRole("alert")).toHaveTextContent("does not look like a debit note");
    expect(screen.queryByRole("button", { name: "Fill the credit note" })).not.toBeInTheDocument();

    readDebitNote.mockResolvedValueOnce(debitNote());
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: /read the customer's debit note/i }));
    await userEvent.upload(screen.getByLabelText("Debit note photo"), photo());
    await userEvent.click(await screen.findByRole("button", { name: "Fill the credit note" }));
    await waitFor(() => expect(screen.getByLabelText("Against invoice *")).toHaveValue("inv701"));
    await userEvent.click(screen.getByText("pick party"));
    expect(screen.getByLabelText("Against invoice *")).toHaveValue("");
    expect(within(screen.getByLabelText("Against invoice *")).queryByRole("option", { name: /INV\/2026-27\/0701/ })).not.toBeInTheDocument();
  });
});

const challan = (over: Partial<TdsChallanResult> = {}): TdsChallanResult => ({
  kind: "challan",
  read: { problem: null, bsrCode: "0510308", challanNo: "00412", depositedOn: "2026-11-05", section: "194C", natureOfPayment: "Payments to contractors", tax: 1000, interest: 15, total: 1015 },
  draft: { month: "2026-10", monthWhy: "2026-10's 194C deductions, ₹1,000, are still to be deposited: this pays them exactly", section: "194C", amount: 1000, interest: 15, bsrCode: "0510308", challanNo: "00412", depositedOn: "2026-11-05", note: "" },
  checks: [], duplicate: null, aiSuggestion: "ai-ch-1",
  ...over,
});

describe("TDS papers, into the registers", () => {
  it("a challan fills the form, with the month it pays rather than the month on screen, and is recorded with the read", async () => {
    readTdsPaper.mockResolvedValue(challan());
    wrap(<StatutoryTab />, "/accounts/statutory?section=tds&month=2026-11");
    await userEvent.click(await screen.findByRole("button", { name: /read the challan/i }));
    await userEvent.upload(screen.getByLabelText("Challan photo"), photo());
    const said = await screen.findByLabelText("What the challan says");
    expect(said).toHaveTextContent("Section 194C");
    expect(said).toHaveTextContent("0510308 / 00412");
    expect(said).toHaveTextContent("this pays them exactly");
    await userEvent.click(within(said).getByRole("button", { name: "Fill the challan" }));

    expect(screen.getByLabelText("For month")).toHaveValue("2026-10");
    expect(screen.getByLabelText("Amount")).toHaveValue(1000);
    expect(screen.getByLabelText("Interest")).toHaveValue(15);
    expect(screen.getByLabelText("BSR code")).toHaveValue("0510308");
    expect(screen.getByLabelText("Challan serial")).toHaveValue("00412");
    expect(screen.getByLabelText("Deposited on")).toHaveValue("2026-11-05");
    expect(screen.getByLabelText("Month the challan pays")).toHaveTextContent("this pays them exactly");
    await userEvent.click(screen.getByRole("button", { name: "Record challan" }));
    expect(readTdsPaper).toHaveBeenCalledWith("challan", [expect.any(File)]);
    expect(addTdsChallan).toHaveBeenCalledWith({ month: "2026-10", section: "194C", amount: 1000, interest: 15, bsrCode: "0510308", challanNo: "00412", depositedOn: "2026-11-05", tdsSuggestion: "ai-ch-1" });
    // The form is ready for the next one, back on the month on screen.
    await waitFor(() => expect(screen.getByLabelText("For month")).toHaveValue("2026-11"));
  });

  it("a challan recorded already is said, and not filled again", async () => {
    readTdsPaper.mockResolvedValue(challan({ duplicate: { _id: "c9", month: "2026-10", section: "194C", amount: 1000 } }));
    wrap(<StatutoryTab />, "/accounts/statutory?section=tds&month=2026-11");
    await userEvent.click(await screen.findByRole("button", { name: /read the challan/i }));
    await userEvent.upload(screen.getByLabelText("Challan photo"), photo());
    expect(await screen.findByText(/Already recorded against 2026-10, section 194C/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fill the challan" })).toBeDisabled();
  });

  it("a Form 16A is confirmed and saved to the certificates received, with the read", async () => {
    const f16: Form16aResult = {
      kind: "form16a",
      read: { problem: null, deductorName: "Sunrise Garments Pvt Ltd", deductorTan: "CHES12345D", deducteePan: "AABFB1234C", certificateNo: "ABCDEFG", assessmentYear: "2027-28", quarter: "Q2", rows: [{ section: "194Q", amountPaid: 500000, tds: 500 }], totalTds: 500 },
      customer: { _id: "c1", name: "Sunrise Garments", matchedBy: "tan" },
      draft: { kind: "received", party: "c1", partyName: "Sunrise Garments", fy: "2026-27", quarter: "Q2", certNo: "ABCDEFG", section: "194Q", amount: 500, on: "2026-11-13", tan: "CHES12345D" },
      checks: [], duplicate: null, aiSuggestion: "ai-16a",
    };
    readTdsPaper.mockResolvedValue(f16);
    wrap(<StatutoryTab />, "/accounts/statutory?section=tds&month=2026-10");
    await userEvent.click(await screen.findByRole("button", { name: "Deducted by customers" }));
    await userEvent.click(await screen.findByRole("button", { name: /read a form 16a/i }));
    await userEvent.upload(screen.getByLabelText("Form 16A file"), photo());
    const said = await screen.findByLabelText("What the certificate says");
    expect(said).toHaveTextContent("TAN CHES12345D");
    expect(said).toHaveTextContent("by TAN");
    expect(within(said).getByLabelText("Financial year")).toHaveValue("2026-27");
    expect(within(said).getByLabelText("Quarter")).toHaveValue("Q2");
    expect(within(said).getByLabelText("TDS (₹)")).toHaveValue(500);
    await userEvent.click(within(said).getByRole("button", { name: "Save the certificate" }));
    expect(readTdsPaper).toHaveBeenCalledWith("form16a", [expect.any(File)]);
    expect(addTdsCertificate).toHaveBeenCalledWith({ kind: "received", party: "c1", fy: "2026-27", quarter: "Q2", certNo: "ABCDEFG", section: "194Q", amount: 500, on: "2026-11-13", tdsSuggestion: "ai-16a" });
  });

  it("a certificate issued to another PAN is said, and one recorded already cannot be saved twice", async () => {
    readTdsPaper.mockResolvedValue({
      kind: "form16a", read: { problem: null, deductorName: "Sunrise", deducteePan: "ZZZZZ9999Z", certificateNo: "X1", quarter: "Q2", rows: [], totalTds: 100 },
      customer: { _id: "c1", name: "Sunrise Garments", matchedBy: "name" }, draft: { kind: "received", party: "c1", partyName: "Sunrise Garments", fy: "2026-27", quarter: "Q2", certNo: "X1", section: "", amount: 100, on: "2026-11-13", tan: "" },
      checks: [{ code: "PAN", severity: "danger", message: "Issued to PAN ZZZZZ9999Z, not ours (AABFB1234C): this certificate is not for us" }], duplicate: { _id: "t0", amount: 100 }, aiSuggestion: null,
    } satisfies Form16aResult);
    wrap(<StatutoryTab />, "/accounts/statutory?section=tds&month=2026-10");
    await userEvent.click(await screen.findByRole("button", { name: "Deducted by customers" }));
    await userEvent.click(await screen.findByRole("button", { name: /read a form 16a/i }));
    await userEvent.upload(screen.getByLabelText("Form 16A file"), photo());
    expect(await screen.findByLabelText("Checks on the certificate")).toHaveTextContent("this certificate is not for us");
    expect(screen.getByText("by name: confirm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save the certificate" })).toBeDisabled();
  });

  it("a Form 16A can be typed in when there is no reader, and is saved without a read", async () => {
    wrap(<StatutoryTab />, "/accounts/statutory?section=tds&month=2026-10");
    await userEvent.click(await screen.findByRole("button", { name: "Deducted by customers" }));
    await userEvent.click(await screen.findByRole("button", { name: /read a form 16a/i }));
    await userEvent.click(screen.getByRole("button", { name: "Type it in instead" }));
    const form = screen.getByLabelText("The certificate");
    const save = within(form).getByRole("button", { name: "Save the certificate" });
    expect(save).toBeDisabled();
    await userEvent.click(within(form).getByText("pick party"));
    await userEvent.type(within(form).getByLabelText("Financial year"), "2026-27");
    await userEvent.selectOptions(within(form).getByLabelText("Quarter"), "Q3");
    await userEvent.type(within(form).getByLabelText("TDS (₹)"), "300");
    await userEvent.click(save);
    expect(readTdsPaper).not.toHaveBeenCalled();
    expect(addTdsCertificate).toHaveBeenCalledWith(expect.objectContaining({ kind: "received", party: "c2", fy: "2026-27", quarter: "Q3", amount: 300, tdsSuggestion: undefined }));
  });

  it("Form 26AS as a PDF goes to the reader; the CSV still goes to the parser", async () => {
    read26asPdf.mockResolvedValue({ kind: "26as", read: { pan: "AABFB1234C", assessmentYear: "2027-28", lines: 2 }, stored: { fy: "2026-27", lines: 2, matched: 2, unmatched: [] }, receivable, aiSuggestion: "ai-26" });
    upload26as.mockResolvedValue({ lines: 3, matched: 3, unmatched: [], receivable });
    wrap(<StatutoryTab />, "/accounts/statutory?section=tds&month=2026-10");
    await userEvent.click(await screen.findByRole("button", { name: "Deducted by customers" }));
    await screen.findByRole("table", { name: "TDS receivable" });
    const pdf = new File(["%PDF"], "26AS.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Form 26AS file"), pdf);
    await waitFor(() => expect(read26asPdf).toHaveBeenCalledWith([pdf], "2026-27"));
    expect(upload26as).not.toHaveBeenCalled();
    const csv = new File(["a,b"], "26AS.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("Form 26AS file"), csv);
    await waitFor(() => expect(upload26as).toHaveBeenCalledWith(csv, "2026-27"));
  });
});

const powerBill = (over: Partial<PowerBillResult> = {}): PowerBillResult => ({
  read: { problem: null },
  draft: { month: "2026-10", consumerNo: "059-001-234", billNo: "B1", billDate: "2026-11-05", periodFrom: "2026-10-01", periodTo: "2026-10-31", units: 24850, demandKva: 180, energyCharges: 186375, demandCharges: 63000, otherCharges: 4200, tax: 12430, total: 266005, dueDate: "2026-11-20", ratePerUnit: 10.7 },
  checks: [], duplicate: null, aiSuggestion: "ai-pw",
  ...over,
});

describe("power cost per metre", () => {
  it("shows each month's bill against the metres woven, and how the cost a metre moved", async () => {
    powerRows = [
      { month: "2026-10", units: 24850, total: 266005, bills: [{ _id: "pb1", consumerNo: "059-001-234", units: 24850, total: 266005 }], metres: 75000, ratePerUnit: 10.7, costPerMetre: 3.55, unitsPerMetre: 0.331, change: 4.12 },
      { month: "2026-09", units: 23000, total: 255000, bills: [{ _id: "pb0", consumerNo: "059-001-234", units: 23000, total: 255000 }], metres: 74800, ratePerUnit: 11.09, costPerMetre: 3.41, unitsPerMetre: 0.307, change: null },
    ];
    wrap(<PowerCost />);
    const table = await screen.findByRole("table", { name: "Power cost by month" });
    const oct = within(table).getByText("Oct 2026").closest("tr")!;
    expect(oct).toHaveTextContent("24,850");
    expect(oct).toHaveTextContent("75,000");
    expect(oct).toHaveTextContent("3.55");
    expect(oct).toHaveTextContent("+4.12%");
    expect(screen.getByLabelText("Power cost per metre")).toHaveTextContent("Oct 2026: ₹3.55 a metre, 0.331 units a metre.");
  });

  it("a month not over is marked, and the line under the title speaks of the last month over", async () => {
    powerRows = [
      { month: "2026-11", units: 9000, total: 96000, bills: [{ _id: "pb2", consumerNo: "059-001-234", units: 9000, total: 96000 }], metres: 13849, ratePerUnit: 10.67, costPerMetre: 6.93, unitsPerMetre: 0.65, change: null, partial: true },
      { month: "2026-10", units: 24850, total: 266005, bills: [{ _id: "pb1", consumerNo: "059-001-234", units: 24850, total: 266005 }], metres: 75000, ratePerUnit: 10.7, costPerMetre: 3.55, unitsPerMetre: 0.331, change: null, partial: false },
    ];
    wrap(<PowerCost />);
    const table = await screen.findByRole("table", { name: "Power cost by month" });
    expect(within(table).getByText("Nov 2026").closest("tr")).toHaveTextContent("month not over");
    expect(within(table).getByText("Oct 2026").closest("tr")).not.toHaveTextContent("month not over");
    expect(screen.getByLabelText("Power cost per metre")).toHaveTextContent("Oct 2026: ₹3.55 a metre");
  });

  it("the bill read is checked, kept for its month with the read, and the report asked again", async () => {
    readPowerBill.mockResolvedValue(powerBill({ checks: [{ code: "PARTS", severity: "warning", message: "Energy, demand, other charges and tax make ₹2,66,000; the bill's total is ₹2,66,005. Check what was read" }] }));
    wrap(<PowerCost />);
    expect(await screen.findByText(/No electricity bill kept yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /read the electricity bill/i }));
    await userEvent.upload(screen.getByLabelText("Electricity bill photo"), photo());
    const form = await screen.findByLabelText("The bill's figures");
    expect(within(form).getByLabelText("For month *")).toHaveValue("2026-10");
    expect(within(form).getByLabelText("Units (kWh) *")).toHaveValue(24850);
    expect(within(form).getByLabelText("Total payable (₹) *")).toHaveValue(266005);
    expect(form).toHaveTextContent("₹10.70 a unit.");
    expect(screen.getByLabelText("Checks on the bill")).toHaveTextContent("Check what was read");
    await userEvent.click(within(form).getByRole("button", { name: "Keep the bill" }));
    expect(savePowerBill).toHaveBeenCalledTimes(1);
    const body = savePowerBill.mock.calls[0][0];
    expect(body).toMatchObject({ month: "2026-10", units: 24850, total: 266005, consumerNo: "059-001-234", energyCharges: 186375, aiSuggestion: "ai-pw" });
    expect(body).not.toHaveProperty("ratePerUnit");
  });

  it("a month kept already cannot be kept twice; with no reader, the bill is typed in", async () => {
    readPowerBill.mockResolvedValue(powerBill({ duplicate: { _id: "pb1", total: 266005, units: 24850 } }));
    wrap(<PowerCost />);
    await userEvent.click(await screen.findByRole("button", { name: /read the electricity bill/i }));
    await userEvent.upload(screen.getByLabelText("Electricity bill photo"), photo());
    expect(await screen.findByText(/is kept already: ₹2,66,005.00 for 24,850 units/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep the bill" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: /type it in/i }));
    const form = await screen.findByLabelText("The bill's figures");
    const keep = within(form).getByRole("button", { name: "Keep the bill" });
    expect(keep).toBeDisabled();
    // user-event types into date and time fields only; a month field is set whole, as a picker does.
    fireEvent.change(within(form).getByLabelText("For month *"), { target: { value: "2026-11" } });
    await userEvent.type(within(form).getByLabelText("Units (kWh) *"), "20000");
    await userEvent.type(within(form).getByLabelText("Total payable (₹) *"), "210000");
    expect(form).toHaveTextContent("₹10.50 a unit.");
    await userEvent.click(keep);
    expect(savePowerBill).toHaveBeenCalledWith(expect.objectContaining({ month: "2026-11", units: 20000, total: 210000, aiSuggestion: undefined }));
  });
});
