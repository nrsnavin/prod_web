import { describe, expect, it } from "vitest";
import { reenterBill, reenterExpense } from "./reenter";
import type { Expense, SupplierBill } from "./types";

// ════════════════════════════════════════════════════════════
//  "CANCEL AND RE-ENTER" OPENS WITH EVERYTHING THE ENTRY HAD
//
//  The dialog says so. What it handed the form was the supplier, the
//  number, the date and the lines — and nothing else. A service bill
//  under reverse charge with TDS came back as a goods bill, no head, no
//  TDS, input credit ticked, due in 30 days and off its receipts: the
//  person corrected the one figure they had come to correct and saved a
//  bill that was now wrong in six other ways.
// ════════════════════════════════════════════════════════════

const bill = (over: Partial<SupplierBill> = {}): SupplierBill => ({
  _id: "b1", billNo: "PB/2026-27/0040", supplier: "s1", supplierName: "Sri Transports", supplierGstin: "33AAAAA0000A1Z5",
  supplierBillNo: "LR-7781", billDate: "2026-11-02T00:00:00.000Z", dueDate: "2026-11-17T00:00:00.000Z",
  purchaseOrder: "po1", poNo: 12, inwards: ["in1", "in2"], kind: "service", category: { _id: "h-freight", name: "Transport & freight" },
  supplyType: "intra", totals: { taxable: 1000, cgst: 0, sgst: 0, igst: 0, tax: 0, roundOff: 0, grand: 1000 } as SupplierBill["totals"],
  lines: [{ description: "Lorry to Tiruppur", hsn: "9965", unit: "trip", quantity: 1, rate: 1000, gstPercent: 5, taxable: 1000, cgst: 0, sgst: 0, igst: 0, amount: 1000 }] as SupplierBill["lines"],
  itc: { eligible: false, amount: 0 }, tds: { applicable: true, section: "194C", rate: 1 },
  paidAmount: 0, tdsAmount: 0, debitedAmount: 0, reverseCharge: true, status: "open", notes: "Checked with Raju",
  costCentre: { kind: "order", order: "o1", orderNo: 412, name: "Order #412" },
  ...over,
});

describe("a bill cancelled to be entered again", () => {
  it("comes back as the bill it was", () => {
    const d = reenterBill(bill());
    expect(d).toMatchObject({
      supplier: { _id: "s1", name: "Sri Transports" }, supplierGstin: "33AAAAA0000A1Z5", billNo: "LR-7781", billDate: "2026-11-02",
      purchaseOrder: "po1", inwards: ["in1", "in2"],
      billKind: "service", category: "h-freight", reverseCharge: true,
      itcEligible: false, tds: { applicable: true, section: "194C", rate: 1 },
      dueDate: "2026-11-17", notes: "Checked with Raju", costCentre: { orderNo: 412 },
    });
    expect(d.lines).toEqual([{ rawMaterial: undefined, description: "Lorry to Tiruppur", hsn: "9965", unit: "trip", quantity: 1, rate: 1000, gstPercent: 5 }]);
    // Typed by a person the first time: not a scan, and not sent back as one.
    expect(d.aiSuggestion).toBeNull();
  });

  it("a head saved as its id, a machine or a department as the cost centre", () => {
    expect(reenterBill(bill({ category: "h-rent" })).category).toBe("h-rent");
    expect(reenterBill(bill({ costCentre: { kind: "machine", machine: "m9", name: "L-12" } })).costCentre).toEqual({ machine: "m9" });
    expect(reenterBill(bill({ costCentre: { kind: "department", department: "Canteen", name: "Canteen" } })).costCentre).toEqual({ department: "Canteen" });
    expect(reenterBill(bill({ costCentre: undefined })).costCentre).toBeUndefined();
  });

  it("a plain goods bill carries no head and stays eligible for credit", () => {
    const d = reenterBill(bill({ kind: "goods", category: undefined, reverseCharge: false, itc: { eligible: true, amount: 50 }, tds: { applicable: false }, dueDate: undefined, notes: undefined }));
    expect(d).toMatchObject({ billKind: "goods", itcEligible: true, reverseCharge: false, tds: { applicable: false } });
    expect(d.category).toBeUndefined();
    expect(d.dueDate).toBeUndefined();
  });
});

describe("an expense cancelled to be entered again", () => {
  const expense: Expense = {
    _id: "e1", expenseNo: "EXP/2026-27/0090", date: "2026-11-05T00:00:00.000Z", category: "h-repairs", categoryName: "Repairs & maintenance",
    description: "Loom 12 belt and bearing", supplier: "s2", payeeName: "Kovai Spares", payeeGstin: "33BBBBB0000B1Z5", refNo: "KS/881",
    supplyType: "intra", totals: { grand: 2360 } as Expense["totals"], itc: { eligible: true, amount: 360 }, status: "approved", paidAmount: 0,
    notes: "Old belt kept for the claim", costCentre: { kind: "machine", machine: "m12", name: "L-12" },
    lines: [
      { description: "Belt", quantity: 1, rate: 1200, gstPercent: 18 }, { description: "Bearing", quantity: 2, rate: 400, gstPercent: 18 },
    ] as Expense["lines"],
  };

  it("keeps what it was for, its notes and where it was booked", () => {
    const d = reenterExpense(expense);
    expect(d).toMatchObject({
      supplier: { _id: "s2", name: "Kovai Spares" }, supplierGstin: "33BBBBB0000B1Z5", billNo: "KS/881", billDate: "2026-11-05",
      description: "Loom 12 belt and bearing", notes: "Old belt kept for the claim", costCentre: { machine: "m12" },
    });
    expect(d.lines).toHaveLength(2);
  });
});
