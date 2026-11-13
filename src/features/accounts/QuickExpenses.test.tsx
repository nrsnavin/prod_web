import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CashLineBox, ReceiptsBatchDialog } from "./QuickExpenses";
import type { ScanResult } from "./types";

// Petty cash in one line, and a week's receipts read together: drafts
// for a person to check, saved only when they say so.

const svc = { expenseFromLine: vi.fn(), scan: vi.fn(), suggestCategory: vi.fn(), createExpense: vi.fn() };
vi.mock("./api", () => ({ accountsService: new Proxy({}, { get: (_t, k: string) => (svc as Record<string, unknown>)[k] }) }));
vi.mock("./hooks", () => ({ useCategories: () => ({ data: [{ _id: "tr", name: "Conveyance", active: true }, { _id: "sw", name: "Staff welfare", active: true }] }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

beforeEach(() => { for (const f of Object.values(svc)) f.mockReset(); toast.mockReset(); });

describe("petty cash in one line", () => {
  it("is read on the server and opens the form as cash already spent", async () => {
    svc.expenseFromLine.mockResolvedValue({ success: true, by: "rules", aiSuggestion: "ai1", problems: [], draft: { amount: 350, date: "2026-11-13", description: "Auto for yarn", payee: "", category: { _id: "tr", name: "Conveyance" }, reason: "“auto” goes under Conveyance" } });
    const onDraft = vi.fn();
    render(<CashLineBox onDraft={onDraft} />);
    await userEvent.type(screen.getByLabelText("Spent cash? Type or say it"), "Paid 350 auto for yarn");
    await userEvent.click(screen.getByRole("button", { name: /fill the form/i }));
    expect(svc.expenseFromLine).toHaveBeenCalledWith("Paid 350 auto for yarn");
    expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({
      billDate: "2026-11-13", source: "line", paidInCash: true, aiSuggestion: "ai1",
      lines: [{ description: "Auto for yarn", quantity: 1, rate: 350, gstPercent: 0 }],
    }), "tr");
    expect(screen.getByLabelText("Spent cash? Type or say it")).toHaveValue("");
  });

  it("says what could not be read, and still opens the form", async () => {
    svc.expenseFromLine.mockResolvedValue({ success: true, by: "rules", aiSuggestion: null, problems: ["No amount was found: type it in"], draft: { amount: null, date: "2026-11-13", description: "Tea", payee: "", category: { _id: "sw", name: "Staff welfare" }, reason: "" } });
    const onDraft = vi.fn();
    render(<CashLineBox onDraft={onDraft} />);
    await userEvent.type(screen.getByLabelText("Spent cash? Type or say it"), "tea{Enter}");
    expect(onDraft.mock.calls[0][0].lines[0].rate).toBe("");
    expect(toast).toHaveBeenCalledWith("No amount was found: type it in", "info");
  });
});

const receipt = (over: Partial<ScanResult["read"]> = {}, extra: Partial<ScanResult> = {}): ScanResult => ({
  read: { kind: "receipt", problem: null, supplierName: "Kumar Tea Stall", supplierGstin: "", billNo: "118", billDate: "2026-11-10", dueDate: null, lines: [{ description: "Tea and snacks", hsn: "", quantity: 1, unit: "", rate: 240, gstPercent: 0, amount: 240, confidence: 0.9 }], totals: { taxable: 240, cgst: null, sgst: null, igst: null, grand: 240 }, confidence: 0.9, ...over },
  supplier: null, alreadyEntered: null, purchaseOrders: [], aiSuggestion: "ai-r", ...extra,
});

describe("several receipts at once", () => {
  it("reads each into its own draft with its head, keeps back one already entered, and saves the rest", async () => {
    svc.scan
      .mockResolvedValueOnce(receipt())
      .mockResolvedValueOnce(receipt({ supplierName: "Murugan Auto", billNo: "", lines: [{ description: "Auto to station", hsn: "", quantity: 1, unit: "", rate: 180, gstPercent: 0, amount: 180, confidence: 0.8 }], totals: { taxable: null, cgst: null, sgst: null, igst: null, grand: null } }, { samePhoto: [{ docType: "Expense", docId: "e1", docNo: "EXP/2026-27/0090", partyName: "Murugan Auto", amount: 180, date: "2026-11-09", exact: true }] }));
    svc.suggestCategory.mockImplementation(async (q: { payee?: string }) => (q.payee === "Kumar Tea Stall" ? { category: "sw", name: "Staff welfare", confidence: 0.9, reason: "" } : { category: "tr", name: "Conveyance", confidence: 0.8, reason: "" }));
    svc.createExpense.mockResolvedValue({ success: true, expense: { _id: "x1", expenseNo: "EXP/2026-27/0101" }, voucher: null });
    const onSaved = vi.fn();
    render(<ReceiptsBatchDialog onClose={() => {}} onSaved={onSaved} />);
    await userEvent.upload(screen.getByLabelText("Receipt photos"), [new File(["a"], "tea.jpg", { type: "image/jpeg" }), new File(["b"], "auto.jpg", { type: "image/jpeg" })]);
    const table = await screen.findByRole("table", { name: "Receipts read" });
    await vi.waitFor(() => expect(within(table).getByLabelText("Head for tea.jpg")).toHaveValue("sw"));
    expect(within(table).getByLabelText("Amount of tea.jpg")).toHaveValue(240);
    expect(within(table).getByLabelText("Save tea.jpg")).toBeChecked();
    // Already entered: kept back, and says as what. No printed total: the lines' sum.
    expect(within(table).getByLabelText("Save auto.jpg")).not.toBeChecked();
    expect(within(table).getByText("Already entered as EXP/2026-27/0090")).toBeInTheDocument();
    expect(within(table).getByLabelText("Amount of auto.jpg")).toHaveValue(180);
    await userEvent.click(screen.getByRole("button", { name: "Save 1 expense" }));
    expect(svc.createExpense).toHaveBeenCalledTimes(1);
    expect(svc.createExpense.mock.calls[0][0]).toMatchObject({ category: "sw", description: "Tea and snacks", date: "2026-11-10", payeeName: "Kumar Tea Stall", refNo: "118", amount: 240, source: "scan", aiSuggestion: "ai-r" });
    expect(svc.createExpense.mock.calls[0][0].requestId).toMatch(/^receipts:/);
    expect(toast).toHaveBeenCalledWith("1 expense saved", "success");
    expect(onSaved).toHaveBeenCalled();
  });

  it("will not save a row without a head", async () => {
    svc.scan.mockResolvedValue(receipt());
    svc.suggestCategory.mockResolvedValue(null);
    render(<ReceiptsBatchDialog onClose={() => {}} onSaved={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Receipt photos"), new File(["a"], "tea.jpg", { type: "image/jpeg" }));
    await screen.findByDisplayValue("Tea and snacks");
    expect(screen.getByText(/1 need a head, an amount or what for/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save 1 expense" })).toBeDisabled();
  });
});
