import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplyCreditDialog, RefundDialog } from "./Credits";
import type { Credit, OpenDoc } from "./types";

// A credit on account is set against open documents, oldest first,
// never past what each owes nor past what the credit has left.

const applyMutate = vi.fn();
const payMutate = vi.fn();
const docs: OpenDoc[] = [
  { docType: "Invoice", id: "i2", docNo: "INV/2026-27/0002", date: "2026-07-10", dueDate: "2026-08-09", party: "c1", partyName: "Sunrise", amount: 5250, outstanding: 5250, overdueDays: 0, bucket: "current" },
  { docType: "Invoice", id: "i1", docNo: "INV/2026-27/0001", date: "2026-06-01", dueDate: "2026-07-01", party: "c1", partyName: "Sunrise", amount: 800, outstanding: 800, overdueDays: 20, bucket: "d30" },
  { docType: "SupplierBill", id: "x", docNo: "PB/1", date: "2026-06-01", dueDate: "2026-07-01", party: "c1", partyName: "?", amount: 1, outstanding: 1, overdueDays: 0, bucket: "current" },
];
vi.mock("./hooks", () => ({
  useAccountsMutations: () => ({ applyCredit: { mutate: applyMutate, isPending: false }, createPayment: { mutate: payMutate, isPending: false } }),
  useBankAccounts: () => ({ data: [{ _id: "cash1", name: "Cash box", kind: "cash" }, { _id: "b1", name: "Kotak CA", kind: "bank" }] }),
  useOpenDocs: () => ({ data: { docs, balance: 0 }, isLoading: false }),
  useCredits: () => ({ data: [] }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const credit: Credit = { sourceType: "AccountNote", id: "n1", docNo: "CN/2026-27/0001", date: "2026-07-01", amount: 1050, available: 1050, label: "Credit note · Rate difference" };

describe("applying a credit", () => {
  it("lists only what a customer credit can settle, oldest first, and fills no more than is left", async () => {
    render(<ApplyCreditDialog credit={credit} partyType="customer" party="c1" onClose={() => {}} />);
    expect(screen.queryByText("PB/1")).not.toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes[0]).toHaveAccessibleName("Apply to INV/2026-27/0001");
    await userEvent.click(screen.getByLabelText("Apply to INV/2026-27/0001"));
    await userEvent.click(screen.getByLabelText("Apply to INV/2026-27/0002"));
    expect(screen.getByLabelText("Apply amount for INV/2026-27/0001")).toHaveValue(800);
    expect(screen.getByLabelText("Apply amount for INV/2026-27/0002")).toHaveValue(250);
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(applyMutate.mock.calls[0][0]).toEqual({ source: { type: "AccountNote", id: "n1" }, allocations: [{ docType: "Invoice", doc: "i1", amount: 800 }, { docType: "Invoice", doc: "i2", amount: 250 }] });
  });

  it("refuses more than the credit has", async () => {
    render(<ApplyCreditDialog credit={credit} partyType="customer" party="c1" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText("Apply to INV/2026-27/0002"));
    const box = screen.getByLabelText("Apply amount for INV/2026-27/0002");
    await userEvent.clear(box);
    await userEvent.type(box, "2000");
    expect(screen.getByText("Only ₹1,050.00 is available on CN/2026-27/0001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});

describe("refunding a credit", () => {
  const advance: Credit = { sourceType: "Payment", id: "p1", docNo: "RCT/2026-27/0004", date: "2026-07-01", amount: 10000, available: 6000, label: "Received on account" };

  it("pays a customer back out of it: a payment voucher naming the credit, through a bank account", async () => {
    render(<RefundDialog credit={advance} partyType="customer" party="c1" onClose={() => {}} />);
    expect(screen.getByText(/Pay the customer back out of received on account · ₹6,000.00 left on it/)).toBeInTheDocument();
    const amount = screen.getByLabelText("Amount *");
    await userEvent.clear(amount);
    await userEvent.type(amount, "4000");
    await userEvent.type(screen.getByLabelText("Reference (UTR)"), "NEFT REF1");
    await userEvent.click(screen.getByRole("button", { name: "Refund ₹4,000.00" }));
    expect(payMutate.mock.calls[0][0]).toMatchObject({
      kind: "payment", partyType: "customer", customer: "c1", amount: 4000, mode: "bank", account: "b1", reference: "NEFT REF1", allocations: [],
      refunds: [{ sourceType: "Payment", id: "p1", amount: 4000 }],
    });
  });

  it("refuses more than is left, and cash comes from the cash box", async () => {
    payMutate.mockReset();
    render(<RefundDialog credit={advance} partyType="supplier" party="s1" onClose={() => {}} />);
    const amount = screen.getByLabelText("Amount *");
    await userEvent.clear(amount);
    await userEvent.type(amount, "7000");
    expect(screen.getByText("Only ₹6,000.00 is left on RCT/2026-27/0004")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refund/ })).toBeDisabled();
    await userEvent.clear(amount);
    await userEvent.type(amount, "500");
    await userEvent.selectOptions(screen.getByLabelText("Received by"), "cash");
    expect(screen.getByLabelText("Into account")).toHaveValue("cash1");
    await userEvent.click(screen.getByRole("button", { name: "Refund ₹500.00" }));
    expect(payMutate.mock.calls[0][0]).toMatchObject({ kind: "receipt", partyType: "supplier", supplier: "s1", mode: "cash", account: "cash1" });
  });
});
