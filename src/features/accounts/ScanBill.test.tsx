import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { draftFrom, ScanBillDialog } from "./ScanBill";
import type { ScanResult } from "./types";

// A scanned bill becomes a draft the form opens with; the person sees
// what was read, how sure the reader was, and whether it is already in.

const scan = vi.fn();
vi.mock("./api", () => ({ accountsService: { scan: (f: File[], qr?: string | null) => scan(f, qr) } }));
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

describe("a scanned bill and its goods receipts", () => {
  const matched: ScanResult = {
    ...result,
    purchaseOrders: [{ _id: "po1", poNo: 701, status: "Partial", receipts: 2, unbilledReceipts: 2 }, { _id: "po2", poNo: 702, status: "Open", receipts: 1, unbilledReceipts: 1 }],
    receiptMatch: {
      purchaseOrder: { _id: "po1", poNo: 701 },
      lines: [{ index: 0, rawMaterial: "m-nylon", material: "Nylon 70D", inwards: ["in1", "in2"], quantityReceived: 40, poRate: 310, quantityMatches: true, rateMatches: true }],
      unmatched: [1],
      receiptsLeft: [],
    },
  };

  it("as a bill: the matched line carries its material, and the receipts go with the bill", () => {
    const d = draftFrom(matched);
    // Two POs with receipts used to mean no PO at all; the match settles it.
    expect(d.purchaseOrder).toBe("po1");
    expect(d.inwards).toEqual(["in1", "in2"]);
    expect(d.lines[0]).toMatchObject({ rawMaterial: "m-nylon", description: "Nylon 70D" });
    expect(d.lines[1].rawMaterial).toBeUndefined();
  });

  it("as an expense: the figures only", () => {
    const d = draftFrom(matched, "expense");
    expect(d.inwards).toBeUndefined();
    expect(d.lines[0].rawMaterial).toBeUndefined();
  });

  it("the dialog says which line took which receipts, and what stays as read", async () => {
    scan.mockResolvedValue(matched);
    render(<ScanBillDialog onClose={() => {}} onUse={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "b.png", { type: "image/png" }));
    const note = await screen.findByLabelText("Goods received");
    expect(note).toHaveTextContent("Goods received on PO #701");
    expect(note).toHaveTextContent("Nylon 70D → Nylon 70D, 2 receipts (40)");
    expect(note).toHaveTextContent("Freight: not goods received, stays as read");
  });
});

describe("a supplier's e-invoice code", () => {
  const coded: ScanResult = {
    ...result,
    einvoice: {
      sellerGstin: "33AAAPS0001F1Z5", buyerGstin: "33AAECB1234F1Z5", docNo: "SY/118", docType: "INV", docDate: "2026-07-04", value: 13610,
      irn: "f1d2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70", signature: "unchecked", signatureNote: "No e-invoice portal key is installed on this server",
      notes: [{ code: "QR_NUMBER", severity: "warning", message: "The bill number was read as SY/113; the code says SY/118" }],
    },
    einvoiceQr: "aaa.bbb.ccc",
  };

  it("says the figures are the portal's, whether the signature was checked, and where the paper read differently", async () => {
    scan.mockResolvedValue(coded);
    render(<ScanBillDialog onClose={() => {}} onUse={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "b.pdf", { type: "application/pdf" }));
    const note = await screen.findByRole("note", { name: "E-invoice code" });
    expect(note).toHaveTextContent("E-invoice code read: the GSTIN, bill number, date and total are the GST portal's");
    expect(note).toHaveTextContent("IRN …3c4d5e6f70 ·");
    expect(note).toHaveTextContent("signature not checked (no e-invoice portal key is installed on this server)");
    expect(note).toHaveTextContent("The bill number was read as SY/113; the code says SY/118");
  });

  it("the code goes with the bill, so the server keeps its IRN; not with an expense", () => {
    expect(draftFrom(coded).einvoiceQr).toBe("aaa.bbb.ccc");
    expect(draftFrom(coded, "expense").einvoiceQr).toBeUndefined();
  });

  it("a PDF is sent without looking for a code here: the server looks itself", async () => {
    scan.mockClear();
    scan.mockResolvedValue(result);
    render(<ScanBillDialog onClose={() => {}} onUse={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "b.pdf", { type: "application/pdf" }));
    await screen.findByText("80% sure");
    expect(scan).toHaveBeenCalledWith([expect.any(File)], null);
  });
});

describe("figures that do not add up", () => {
  it("are listed before the form opens, and the wrong line is marked", async () => {
    scan.mockResolvedValue({
      ...result,
      checks: { ok: false, computed: { taxable: 12900, tax: 710, grand: 13610 }, issues: [{ code: "LINE_MATH", severity: "danger", line: 0, message: "Line 1: 40 × 310 is 12,400, the bill says 12,000" }] },
    } satisfies ScanResult);
    render(<ScanBillDialog onClose={() => {}} onUse={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "b.png", { type: "image/png" }));
    const alert = await screen.findByRole("alert", { name: "Figures that do not add up" });
    expect(alert).toHaveTextContent("These figures do not add up: check them against the bill");
    expect(alert).toHaveTextContent("Line 1: 40 × 310 is 12,400, the bill says 12,000");
    expect(screen.getByText("Nylon 70D", { selector: "td" }).closest("tr")).toHaveClass("text-status-danger");
  });

  it("a bill that adds up shows nothing", async () => {
    scan.mockResolvedValue({ ...result, checks: { ok: true, issues: [], computed: { taxable: 12900, tax: 710, grand: 13610 } } });
    render(<ScanBillDialog onClose={() => {}} onUse={() => {}} />);
    await userEvent.upload(screen.getByLabelText("Bill photo or PDF"), new File(["x"], "b.png", { type: "image/png" }));
    await screen.findByText("80% sure");
    expect(screen.queryByRole("alert", { name: "Figures that do not add up" })).not.toBeInTheDocument();
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
