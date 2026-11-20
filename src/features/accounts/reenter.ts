import type { ScanDraft } from "./ScanBill";
import type { CostCentre, CostCentreInput, Expense, SupplierBill } from "./types";

// ══════════════════════════════════════════════════════════════════
//  "CANCEL AND RE-ENTER"
//
//  A bill or expense entered wrongly is cancelled with a reason and the
//  form opens "with everything it had, to correct". What it had is more
//  than the lines: whether it is a service bill and under which head,
//  TDS, input credit, reverse charge, the receipts it bills, when it
//  falls due, the notes, where it is booked. The form was handed the
//  supplier, the number, the date and the lines, and quietly reset the
//  rest — so correcting one figure saved a bill wrong in six other ways.
//
//  One place builds the draft now, from the whole document.
// ══════════════════════════════════════════════════════════════════

const day = (d?: string | null) => (d ? String(d).slice(0, 10) : undefined);

/** A stored cost centre as the form takes one. An order goes by its number, which is what the field asks for. */
export function costCentreInput(c?: CostCentre | null): CostCentreInput | undefined {
  if (!c) return undefined;
  if (c.kind === "order") return c.orderNo ? { orderNo: c.orderNo } : undefined;
  if (c.kind === "machine") return c.machine ? { machine: c.machine } : undefined;
  return c.department ? { department: c.department } : undefined;
}

export function reenterBill(bill: SupplierBill): ScanDraft {
  return {
    supplier: { _id: bill.supplier, name: bill.supplierName }, supplierName: bill.supplierName, supplierGstin: bill.supplierGstin ?? "",
    billNo: bill.supplierBillNo, billDate: day(bill.billDate) ?? null,
    purchaseOrder: bill.purchaseOrder,
    // The receipts are free again once the bill is cancelled; the bill entered in its place bills the same ones.
    inwards: bill.inwards?.length ? bill.inwards : undefined,
    aiSuggestion: null, kind: "bill",
    billKind: bill.kind,
    category: (typeof bill.category === "object" ? bill.category?._id : bill.category) || undefined,
    reverseCharge: !!bill.reverseCharge,
    itcEligible: bill.itc?.eligible !== false,
    tds: { applicable: !!bill.tds?.applicable, section: bill.tds?.section, rate: bill.tds?.rate },
    dueDate: day(bill.dueDate),
    notes: bill.notes || undefined,
    costCentre: costCentreInput(bill.costCentre),
    lines: (bill.lines ?? []).map((l) => ({ rawMaterial: l.rawMaterial, description: l.description, hsn: l.hsn, unit: l.unit, quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent })),
  };
}

export function reenterExpense(e: Expense): ScanDraft {
  return {
    supplier: e.supplier ? { _id: e.supplier, name: e.payeeName ?? "" } : undefined, supplierName: e.payeeName ?? "", supplierGstin: e.payeeGstin ?? "",
    billNo: e.refNo ?? "", billDate: day(e.date) ?? null, aiSuggestion: null, kind: "bill",
    // What it was for is the expense's own, not any one line's.
    description: e.description || undefined,
    notes: e.notes || undefined,
    costCentre: costCentreInput(e.costCentre),
    lines: (e.lines ?? []).map((l) => ({ description: l.description, hsn: l.hsn, unit: l.unit, quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent })),
  };
}
