import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoucherForm } from "./VouchersTab";
import type { OpenDoc } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A VOUCHER SETTLES WHAT IS OWED, NEVER MORE
//
//  Ticking an open document fills its outstanding; the cash follows the
//  ticks; on a payment the TDS rate comes off each bill's gross and the
//  cash is the rest; an allocation over the outstanding stops the
//  voucher with a reason.
// ══════════════════════════════════════════════════════════════════

const createMutate = vi.fn();
let docs: OpenDoc[] = [];
vi.mock("./hooks", () => ({
  useAccountsMutations: () => ({ createPayment: { mutate: createMutate, isPending: false } }),
  useBankAccounts: () => ({ data: [{ _id: "acc1", name: "Kotak CA", kind: "bank", balance: 50000, isDefault: true, active: true }] }),
  useOpenDocs: (partyType?: string, party?: string) => ({ data: partyType && party ? { docs, balance: 0 } : undefined, isLoading: false }),
}));
vi.mock("./shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared")>();
  return { ...actual, PartyPicker: ({ onChange }: { onChange: (id: string, name: string) => void }) => <button onClick={() => onChange("s1", "Sri Yarn")}>pick party</button> };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const doc = (over: Partial<OpenDoc>): OpenDoc => ({ docType: "SupplierBill", id: "b1", docNo: "PB/2026-27/0001", date: "2026-07-04", dueDate: "2026-08-03", party: "s1", partyName: "Sri Yarn", amount: 52500, outstanding: 52500, overdueDays: 0, bucket: "current", tds: { section: "194C", rate: 2 }, ...over });

beforeEach(() => { createMutate.mockReset(); docs = [doc({}), doc({ id: "b2", docNo: "PB/2026-27/0002", amount: 1050, outstanding: 1050, tds: null })]; });

describe("a payment voucher", () => {
  it("fills the ticked bill's outstanding, deducts TDS at the bill's rate, and pays the rest", async () => {
    render(<VoucherForm kind="payment" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByText("pick party"));
    await userEvent.click(await screen.findByLabelText("Settle PB/2026-27/0001"));
    expect(screen.getByLabelText("Amount for PB/2026-27/0001")).toHaveValue(52500);
    // 2% of 52,500 = 1,050 deducted → 51,450 paid
    const summary = screen.getByLabelText("Voucher summary");
    expect(summary).toHaveTextContent("TDS deducted₹1,050.00");
    expect(summary).toHaveTextContent("Settles₹52,500.00");
    expect(screen.getByLabelText("Amount paid *")).toHaveValue(51450);

    await userEvent.click(screen.getByRole("button", { name: /post payment/i }));
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0][0]).toMatchObject({ kind: "payment", partyType: "supplier", supplier: "s1", amount: 51450, account: "acc1", mode: "bank", allocations: [{ docType: "SupplierBill", doc: "b1", amount: 52500 }] });
    expect(createMutate.mock.calls[0][0].tds).toBeUndefined(); // the bill's own rate applied, none typed
  });

  it("a typed rate overrides, and part of a bill can be settled", async () => {
    render(<VoucherForm kind="payment" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByText("pick party"));
    await userEvent.click(await screen.findByLabelText("Settle PB/2026-27/0002"));
    const box = screen.getByLabelText("Amount for PB/2026-27/0002");
    await userEvent.clear(box);
    await userEvent.type(box, "500");
    await userEvent.type(screen.getByLabelText("TDS rate %"), "10");
    expect(screen.getByLabelText("Amount paid *")).toHaveValue(450);
    await userEvent.click(screen.getByRole("button", { name: /post payment/i }));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ amount: 450, tds: { section: "194C", rate: 10 }, allocations: [{ doc: "b2", amount: 500 }] });
  });

  it("refuses more than is outstanding, and a voucher short of its allocations", async () => {
    render(<VoucherForm kind="payment" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByText("pick party"));
    await userEvent.click(await screen.findByLabelText("Settle PB/2026-27/0002"));
    const box = screen.getByLabelText("Amount for PB/2026-27/0002");
    await userEvent.clear(box);
    await userEvent.type(box, "2000");
    expect(screen.getByText("PB/2026-27/0002 has only ₹1,050.00 outstanding")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post payment/i })).toBeDisabled();
    await userEvent.clear(box);
    await userEvent.type(box, "1000");
    const paid = screen.getByLabelText("Amount paid *");
    await userEvent.clear(paid);
    await userEvent.type(paid, "600");
    expect(screen.getByText(/The ticked documents need ₹1,000.00; the voucher is for ₹600.00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post payment/i })).toBeDisabled();
  });
});

describe("TDS and short payments", () => {
  it("deducts TDS on the bill's value net of GST, not on the GST", async () => {
    docs = [doc({ taxableRatio: 50000 / 52500 })];
    render(<VoucherForm kind="payment" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByText("pick party"));
    await userEvent.click(await screen.findByLabelText("Settle PB/2026-27/0001"));
    // 2% of 50,000 (the 2,500 GST is not deducted on) = 1,000 → 51,500 paid
    expect(screen.getByLabelText("Voucher summary")).toHaveTextContent("TDS deducted₹1,000.00");
    expect(screen.getByLabelText("Amount paid *")).toHaveValue(51500);
  });

  it("a receipt short by bank charges settles the invoice in full with one click", async () => {
    docs = [{ docType: "Invoice", id: "i1", docNo: "INV/2026-27/0001", date: "2026-06-01", dueDate: "2026-07-01", party: "c1", partyName: "Sunrise", amount: 100000, outstanding: 100000, overdueDays: 0, bucket: "current" }];
    render(<VoucherForm kind="receipt" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByText("pick party"));
    await userEvent.click(await screen.findByLabelText("Settle INV/2026-27/0001"));
    const received = screen.getByLabelText("Amount received *");
    await userEvent.clear(received);
    await userEvent.type(received, "99950");
    expect(screen.getByText(/₹50.00 short/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post receipt/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Bank charges" }));
    expect(screen.getByLabelText("Adjustment 1 amount")).toHaveValue(50);
    await userEvent.click(screen.getByRole("button", { name: /post receipt/i }));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ amount: 99950, adjustments: [{ kind: "bank_charges", amount: 50 }], allocations: [{ doc: "i1", amount: 100000 }] });
  });

  it("ticks the documents it was opened for", async () => {
    docs = [doc({}), doc({ id: "b2", docNo: "PB/2026-27/0002", amount: 1050, outstanding: 1050, tds: null })];
    render(<VoucherForm kind="payment" initialParty={{ id: "s1", name: "Sri Yarn" }} initialDocs={["b2"]} onDone={() => {}} onCancel={() => {}} />);
    expect(await screen.findByLabelText("Amount for PB/2026-27/0002")).toHaveValue(1050);
    expect(screen.getByLabelText("Settle PB/2026-27/0001")).not.toBeChecked();
  });
});

describe("a receipt voucher", () => {
  it("has no TDS, and what is not allocated stays on account", async () => {
    docs = [{ docType: "Invoice", id: "i1", docNo: "INV/2026-27/0001", date: "2026-06-01", dueDate: "2026-07-01", party: "c1", partyName: "Sunrise", amount: 10500, outstanding: 10500, overdueDays: 40, bucket: "d60" }];
    render(<VoucherForm kind="receipt" onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByText("pick party"));
    expect(screen.queryByLabelText("TDS rate %")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText("Settle INV/2026-27/0001"));
    expect(screen.getByText("40d overdue")).toBeInTheDocument();
    const received = screen.getByLabelText("Amount received *");
    await userEvent.clear(received);
    await userEvent.type(received, "12000");
    expect(within(screen.getByLabelText("Voucher summary")).getByText("₹1,500.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /post receipt/i }));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ kind: "receipt", partyType: "customer", customer: "s1", amount: 12000, allocations: [{ docType: "Invoice", doc: "i1", amount: 10500 }] });
  });
});
