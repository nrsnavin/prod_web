import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BillForm } from "./BillsTab";
import { ExpenseForm } from "./ExpensesTab";
import { reenterBill, reenterExpense } from "./reenter";
import type { Expense, SupplierBill } from "./types";

// The other half of "cancel and re-enter": the form opened with the whole
// draft sends the whole of it back, when nothing is touched.

const createBill = vi.fn();
const createExpense = vi.fn();
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useAccountsMutations: () => ({ createBill: { mutate: createBill, isPending: false }, createExpense: { mutate: createExpense, isPending: false } }),
  useBillPoInfo: () => ({ data: undefined }),
  useCategories: () => ({ data: [{ _id: "h-freight", name: "Transport & freight", itcEligible: true, approvalAbove: 5000 }, { _id: "h-repairs", name: "Repairs & maintenance", itcEligible: true, approvalAbove: 5000 }] }),
  useBankAccounts: () => ({ data: [{ _id: "b1", name: "Kotak CA", kind: "bank", isDefault: true, balance: 0 }] }),
  useBills: () => ({ data: undefined, isLoading: false }),
  useExpenses: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./Flags", () => ({ useFlags: () => [], FlagList: () => null, riskFlags: () => null }));
vi.mock("./api", () => ({ accountsService: { suggestCategory: () => Promise.resolve(null) } }));
vi.mock("@/features/settings/hooks", () => ({ useDocumentSettings: () => ({ data: { gstin: "33CCCCC0000C1Z5", invoice: { stateCode: "33", defaultGstPercent: 5 } } }) }));
vi.mock("@/features/suppliers/api", () => ({
  supplierService: { getById: () => Promise.resolve({ gstin: "33AAAAA0000A1Z5" }), list: () => Promise.resolve({ suppliers: [] }) },
  poService: { list: () => Promise.resolve({ pos: [{ _id: "po1", poNo: 12, status: "Open" }] }) },
}));
vi.mock("@/features/customers/api", () => ({ customerService: { list: () => Promise.resolve({ customers: [] }) } }));
vi.mock("@/features/machines/hooks", () => ({ useMachines: () => ({ data: [{ _id: "m12", ID: "L-12", manufacturer: "Muller" }] }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "accounts" } }) }));

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

beforeEach(() => { createBill.mockReset(); createExpense.mockReset(); });

describe("the bill form, opened on a bill being entered again", () => {
  const bill = {
    _id: "b1", billNo: "PB/2026-27/0040", supplier: "s1", supplierName: "Sri Transports", supplierGstin: "33AAAAA0000A1Z5",
    supplierBillNo: "LR-7781", billDate: "2026-11-02T00:00:00.000Z", dueDate: "2026-11-17T00:00:00.000Z",
    purchaseOrder: "po1", poNo: 12, inwards: ["in1", "in2"], kind: "service", category: { _id: "h-freight", name: "Transport & freight" },
    supplyType: "intra", totals: { grand: 1000 },
    lines: [{ description: "Lorry to Tiruppur", hsn: "9965", unit: "trip", quantity: 1, rate: 1000, gstPercent: 5 }],
    itc: { eligible: false, amount: 0 }, tds: { applicable: true, section: "194C", rate: 1 },
    paidAmount: 0, tdsAmount: 0, debitedAmount: 0, reverseCharge: true, status: "open", notes: "Checked with Raju",
    costCentre: { kind: "order", order: "o1", orderNo: 412, name: "Order #412" },
  } as unknown as SupplierBill;

  it("sends back the service bill it was: head, TDS, no input credit, reverse charge, its receipts, its due date", async () => {
    wrap(<BillForm initialDraft={reenterBill(bill)} onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-11-17");
    expect(screen.getByLabelText("Notes")).toHaveValue("Checked with Raju");
    expect(screen.getByLabelText("Order number")).toHaveValue(412);
    await userEvent.click(screen.getByRole("button", { name: "Enter bill" }));
    expect(createBill).toHaveBeenCalledTimes(1);
    expect(createBill.mock.calls[0][0]).toMatchObject({
      supplier: "s1", supplierBillNo: "LR-7781", billDate: "2026-11-02", dueDate: "2026-11-17",
      purchaseOrder: "po1", inwards: ["in1", "in2"],
      kind: "service", category: "h-freight", reverseCharge: true, itcEligible: false,
      tds: { applicable: true, section: "194C", rate: 1 },
      notes: "Checked with Raju", costCentre: { orderNo: 412 },
    });
    // Typed by a person: it does not go back as a scan.
    expect(createBill.mock.calls[0][0].source).toBeUndefined();
  });

  it("a blank form still opens on its own defaults", () => {
    wrap(<BillForm onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Due date")).toHaveValue("");
    expect(screen.getByLabelText("Input credit can be claimed")).toBeChecked();
    expect(screen.getByLabelText("TDS applies when paying")).not.toBeChecked();
  });
});

describe("the expense form, opened on an expense being entered again", () => {
  const expense = {
    _id: "e1", expenseNo: "EXP/2026-27/0090", date: "2026-11-05T00:00:00.000Z", category: "h-repairs", categoryName: "Repairs & maintenance",
    description: "Loom 12 belt and bearing", supplier: "s2", payeeName: "Kovai Spares", payeeGstin: "33BBBBB0000B1Z5", refNo: "KS/881",
    supplyType: "intra", totals: { grand: 2360 }, itc: { eligible: true, amount: 360 }, status: "approved", paidAmount: 0,
    notes: "Old belt kept for the claim", costCentre: { kind: "machine", machine: "m12", name: "L-12" },
    lines: [{ description: "Belt", quantity: 1, rate: 1200, gstPercent: 18 }, { description: "Bearing", quantity: 2, rate: 400, gstPercent: 18 }],
  } as unknown as Expense;

  it("sends back what it was for, its notes and the machine it was booked to", async () => {
    wrap(<ExpenseForm initialDraft={reenterExpense(expense)} initialCategory={expense.category} onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("What for *")).toHaveValue("Loom 12 belt and bearing");
    await userEvent.click(screen.getByRole("button", { name: /Record expense|Send for approval/ }));
    expect(createExpense).toHaveBeenCalledTimes(1);
    expect(createExpense.mock.calls[0][0]).toMatchObject({
      category: "h-repairs", description: "Loom 12 belt and bearing", date: "2026-11-05", supplier: "s2", payeeName: "Kovai Spares", refNo: "KS/881",
      notes: "Old belt kept for the claim", costCentre: { machine: "m12" },
    });
    expect(createExpense.mock.calls[0][0].lines).toHaveLength(2);
  });
});
