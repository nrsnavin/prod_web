import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseForm } from "./ExpensesTab";

// ══════════════════════════════════════════════════════════════════
//  AN EXPENSE KNOWS WHETHER IT NEEDS AN APPROVER
//
//  The head says: always, or only above an amount. Below the line it
//  can be paid on the spot; above it the button sends it for approval
//  and the pay-now choice is withdrawn.
// ══════════════════════════════════════════════════════════════════

const createMutate = vi.fn();
vi.mock("./hooks", () => ({
  useAccountsMutations: () => ({ createExpense: { mutate: createMutate, isPending: false } }),
  useBankAccounts: () => ({ data: [{ _id: "cash", name: "Cash box", kind: "cash", balance: 4000, isDefault: true, active: true }] }),
  useCategories: () => ({ data: [
    { _id: "tr", name: "Transport & freight", itcEligible: true, approvalAbove: 5000, active: true },
    { _id: "eb", name: "Electricity", itcEligible: false, approvalAbove: 0, active: true },
  ] }),
}));
vi.mock("@/features/settings/hooks", () => ({ useDocumentSettings: () => ({ data: { gstin: "33AAECB1234F1Z5", invoice: { stateCode: "33" } } }) }));
vi.mock("./shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared")>();
  return { ...actual, PartyPicker: () => null };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeEach(() => createMutate.mockReset());

describe("the expense form", () => {
  it("below the head's limit: no approval, paid on the spot from the cash box", async () => {
    render(<ExpenseForm onDone={() => {}} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Head *"), "tr");
    await userEvent.type(screen.getByLabelText("What for *"), "Auto to station");
    await userEvent.type(screen.getByLabelText("Amount before GST *"), "800");
    expect(screen.getByText("No approval needed at this amount.")).toBeInTheDocument();
    expect(screen.getByLabelText("Expense total")).toHaveTextContent("₹944.00"); // 18% proposed on a claimable head
    await userEvent.click(screen.getByLabelText(/Already paid/));
    await userEvent.click(screen.getByRole("button", { name: /record and pay/i }));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ category: "tr", description: "Auto to station", amount: 800, gstPercent: 18, payNow: { account: "cash" } });
  });

  it("above it: sent for approval, and cannot be marked paid", async () => {
    render(<ExpenseForm onDone={() => {}} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Head *"), "tr");
    await userEvent.type(screen.getByLabelText("What for *"), "Lorry to Tiruppur");
    await userEvent.type(screen.getByLabelText("Amount before GST *"), "6000");
    expect(screen.getByText(/Needs approval \(above ₹5,000.00 on this head\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Already paid/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /send for approval/i }));
    expect(createMutate.mock.calls[0][0].payNow).toBeUndefined();
  });

  it("a head that always needs approval says so, and its GST is not claimable", async () => {
    render(<ExpenseForm onDone={() => {}} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Head *"), "eb");
    await userEvent.type(screen.getByLabelText("What for *"), "EB bill");
    await userEvent.type(screen.getByLabelText("Amount before GST *"), "3000");
    expect(screen.getByText("Needs approval on this head.")).toBeInTheDocument();
    expect(screen.getByLabelText("Expense total")).toHaveTextContent("₹3,000.00");
  });
});
