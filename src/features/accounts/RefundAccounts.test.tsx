import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefundDialog } from "./Credits";
import type { Credit } from "./types";

// ════════════════════════════════════════════════════════════
//  A REFUND IS OFFERED ONLY THE ACCOUNTS IT CAN GO THROUGH
//
//  Every other voucher form leaves out an account that has been closed,
//  and knows a credit card is paid on by card and nothing else. The
//  refund dialog listed them all — and chose the first, so with a closed
//  account at the top of the list the refund was refused with "Account
//  not found" by a server that had been sent an account the person never
//  picked.
// ════════════════════════════════════════════════════════════

const payMutate = vi.fn();
vi.mock("./hooks", () => ({
  useAccountsMutations: () => ({ applyCredit: { mutate: vi.fn(), isPending: false }, createPayment: { mutate: payMutate, isPending: false } }),
  useBankAccounts: () => ({ data: [
    { _id: "old", name: "SBI (closed)", kind: "bank", active: false },
    { _id: "card", name: "HDFC credit card", kind: "card" },
    { _id: "oldcash", name: "Old cash box", kind: "cash", active: false },
    { _id: "cash1", name: "Cash box", kind: "cash" },
    { _id: "b1", name: "Kotak CA", kind: "bank" },
  ] }),
  useOpenDocs: () => ({ data: { docs: [], balance: 0 }, isLoading: false }),
  useCredits: () => ({ data: [] }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const advance: Credit = { sourceType: "Payment", id: "p1", docNo: "RCT/2026-27/0004", date: "2026-07-01", amount: 10000, available: 6000, label: "Received on account" };
const optionsOf = (label: string) => within(screen.getByLabelText(label)).getAllByRole("option").map((o) => o.textContent);

describe("the accounts a refund can go through", () => {
  it("by bank: the open bank accounts — not a closed one, not a credit card", async () => {
    render(<RefundDialog credit={advance} partyType="customer" party="c1" onClose={() => {}} />);
    expect(optionsOf("From account")).toEqual(["Kotak CA"]);
    await userEvent.click(screen.getByRole("button", { name: /Refund ₹6,000.00/ }));
    expect(payMutate.mock.calls[0][0]).toMatchObject({ account: "b1", mode: "bank" });
  });

  it("in cash: the cash box that is open", async () => {
    render(<RefundDialog credit={advance} partyType="customer" party="c1" onClose={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText("Paid by"), "cash");
    expect(optionsOf("From account")).toEqual(["Cash box"]);
  });
});
