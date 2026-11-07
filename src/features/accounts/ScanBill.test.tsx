import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { draftFrom, ScanBillDialog } from "./ScanBill";
import type { ScanResult } from "./types";

// A scanned bill becomes a draft the form opens with; the person sees
// what was read, how sure the reader was, and whether it is already in.

const scan = vi.fn();
vi.mock("./api", () => ({ accountsService: { scan: (f: File[]) => scan(f) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const result: ScanResult = {
  read: {
    kind: "bill", problem: null, supplierName: "SRI YARN TRADERS", supplierGstin: "33AAAPS0001F1Z5", billNo: "SY/118", billDate: "2026-07-04", dueDate: null,
    lines: [{ description: "Nylon 70D", hsn: "5402", quantity: 40, unit: "kg", rate: 310, gstPercent: 5, amount: 12400, confidence: 0.92 }, { description: "Freight", hsn: "", quantity: 1, unit: "", rate: 500, gstPercent: 18, amount: 500, confidence: 0.5 }],
    totals: { taxable: 12900, cgst: 355, sgst: 355, igst: null, grand: 13610 }, confidence: 0.8,
  },
  supplier: { _id: "s1", name: "Sri Yarn Traders", matchedBy: "gstin" },
  alreadyEntered: null,
  purchaseOrders: [{ _id: "po1", poNo: 701, status: "Partial", receipts: 1, unbilledReceipts: 1 }],
  aiSuggestion: "ai1",
};

describe("draftFrom", () => {
  it("carries the supplier, their number and date, the lines and the one PO with receipts to bill", () => {
    const d = draftFrom(result);
    expect(d).toMatchObject({ supplier: { _id: "s1", name: "Sri Yarn Traders" }, billNo: "SY/118", billDate: "2026-07-04", purchaseOrder: "po1", aiSuggestion: "ai1", kind: "bill" });
    expect(d.lines).toEqual([
      { description: "Nylon 70D", hsn: "5402", unit: "kg", quantity: 40, rate: 310, gstPercent: 5 },
      { description: "Freight", hsn: "", unit: "", quantity: 1, rate: 500, gstPercent: 18 },
    ]);
    expect(draftFrom({ ...result, purchaseOrders: [] }).purchaseOrder).toBeUndefined();
    expect(draftFrom({ ...result, read: { ...result.read, lines: [{ ...result.read.lines[0], rate: null, gstPercent: null }] } }).lines[0]).toMatchObject({ rate: "", gstPercent: "" });
  });
});

describe("the scan dialog", () => {
  it("shows what was read, flags an unsure line, and hands the draft on", async () => {
    scan.mockResolvedValue(result);
    const onUse = vi.fn();
    render(<ScanBillDialog onClose={() => {}} onUse={onUse} />);
    const file = new File([new Uint8Array([1, 2, 3])], "bill.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), file);
    expect(await screen.findByText("Sri Yarn Traders")).toBeInTheDocument();
    expect(screen.getByText("80% sure")).toBeInTheDocument();
    expect(screen.getByText("Freight").closest("tr")).toHaveClass("text-status-warning");
    expect(screen.getByText(/PO #701 \(1 receipt to bill\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /use as supplier bill/i }));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ billNo: "SY/118", purchaseOrder: "po1" }), "bill");
  });

  it("will not use a bill that is already entered, and says when the photo is not a bill", async () => {
    scan.mockResolvedValue({ ...result, alreadyEntered: "PB/2026-27/0003" });
    render(<ScanBillDialog onClose={() => {}} onUse={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "b.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already entered as PB/2026-27/0003");
    expect(screen.getByRole("button", { name: /use as supplier bill/i })).toBeDisabled();
    scan.mockResolvedValue({ ...result, read: { ...result.read, kind: null, problem: "not_a_bill", lines: [] }, supplier: null });
    await userEvent.click(screen.getByRole("button", { name: /scan another/i }));
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "cat.png", { type: "image/png" }));
    expect(await screen.findByText(/does not look like a bill/)).toBeInTheDocument();
  });

  it("holds a photo that is already on a saved bill until they say it is a different bill", async () => {
    scan.mockResolvedValue({ ...result, samePhoto: [{ docType: "SupplierBill", docId: "b12", docNo: "PB/2026-27/0012", partyName: "Sri Yarn Traders", amount: 23100, date: "2026-10-03", exact: false }] });
    render(<ScanBillDialog onClose={() => {}} onUse={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "b.jpg", { type: "image/jpeg" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This photo is already on bill PB/2026-27/0012 (Sri Yarn Traders, ₹23,100");
    expect(screen.getByRole("button", { name: /use as supplier bill/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /use as expense/i })).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/It is a different bill/));
    expect(screen.getByRole("button", { name: /use as supplier bill/i })).toBeEnabled();
  });
});
