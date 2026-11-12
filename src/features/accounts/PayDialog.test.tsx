import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/core/http/httpClient";
import { PayDialog, type PayBody } from "./ExpensesTab";
import { riskFlags } from "./Flags";
import type { Flag } from "./types";

// Paying an expense goes through the same checks as any payment: a
// payee whose bank account changed lately, or is shared with another
// supplier, stops it until someone says how they confirmed it. The
// dialog used to send the account and nothing else, so such a payment
// from this screen either went unchecked or could not be made at all.

vi.mock("./hooks", () => ({
  useBankAccounts: () => ({ data: [{ _id: "k", name: "Kotak CA", kind: "bank", balance: 250000, isDefault: true, active: true }, { _id: "c", name: "Cash box", kind: "cash", balance: 15000, active: true }] }),
}));
vi.mock("./api", () => ({ accountsService: {} }));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "accounts" } }) }));

const flags: Flag[] = [{ code: "BANK_CHANGED", severity: "danger", message: "Sri Yarns' bank account was changed 3 days ago by Owner" }];
const stopped = () => new ApiError("Stopped: say how you confirmed it to pay", 409, undefined, "PAYMENT_RISK", { details: { flags } });

const sent: PayBody[] = [];
let answer: (body: PayBody) => unknown;
const open = () => render(
  <PayDialog title="Pay EXP/2026-27/0012" amount={11800} onClose={vi.fn()}
    onConfirm={(body, onRisk) => { sent.push(body); const e = answer(body); const f = riskFlags(e); if (f) onRisk(f); }} />,
);

beforeEach(() => { sent.length = 0; answer = () => null; });

describe("paying an expense", () => {
  it("sends the account and the reference, and nothing about risk when there is none", async () => {
    open();
    expect(screen.getByRole("dialog")).toHaveTextContent("₹11,800.00 goes out from:");
    expect(screen.getByLabelText("Account")).toHaveValue("k");
    await userEvent.type(screen.getByLabelText("Reference (UTR, cheque, UPI ref)"), " UTR 2611AX ");
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    expect(sent).toEqual([{ account: "k", reference: "UTR 2611AX" }]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stopped for a risk, shows why and waits for how it was confirmed", async () => {
    answer = (body) => (body.confirmRisk ? null : stopped());
    open();
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    const alert = await screen.findByRole("alert", { name: "Payment stopped" });
    expect(alert).toHaveTextContent("Stopped before the money goes");
    expect(alert).toHaveTextContent("Sri Yarns' bank account was changed 3 days ago by Owner");
    // "Pay" is gone: the only ways on are to say how it was confirmed, or not to pay.
    expect(screen.queryByRole("button", { name: "Pay" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Don't pay" })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmed — pay" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(alert).getByLabelText("How you confirmed it *"), "Called");
    expect(confirm).toBeDisabled();
    await userEvent.type(within(alert).getByLabelText("How you confirmed it *"), " Sri Yarns on the number on file");
    await userEvent.click(confirm);
    expect(sent).toEqual([
      { account: "k", reference: undefined },
      { account: "k", reference: undefined, confirmRisk: true, riskNote: "Called Sri Yarns on the number on file" },
    ]);
  });
});

describe("what counts as a payment stopped for a risk", () => {
  it("is the server's PAYMENT_RISK answer, with its flags; nothing else", () => {
    expect(riskFlags(stopped())).toEqual(flags);
    expect(riskFlags(new ApiError("Stopped", 409, undefined, "PAYMENT_RISK", {}))).toEqual([]);
    expect(riskFlags(new ApiError("The books are locked", 423, undefined, "BOOKS_LOCKED"))).toBeNull();
    expect(riskFlags(new Error("offline"))).toBeNull();
    expect(riskFlags(null)).toBeNull();
  });
});
