import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChequeCard, chequeStageLabel, type ChequeRow } from "./Cheque";

// A cheque on the voucher's own page: received → deposited → cleared,
// each step with its date, or returned; and the next thing to do.

const chequeAction = vi.fn().mockResolvedValue({ success: true, payment: {} });
vi.mock("./api", () => ({ accountsService: { chequeAction: (...a: unknown[]) => chequeAction(...a) } }));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useBankAccounts: () => ({ data: [{ _id: "cash", name: "Cash box", kind: "cash" }, { _id: "b1", name: "Kotak CA", kind: "bank", isDefault: true }] }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const row = (over: Partial<ChequeRow> = {}, cheque: Partial<ChequeRow["cheque"]> = {}): ChequeRow => ({
  _id: "p1", kind: "receipt", voucherNo: "RCT/2026-27/0014", date: "2026-11-01", partyName: "Sunrise Garments", amount: 50000, account: "b1", accountName: "Kotak CA", status: "posted",
  cheque: { number: "000412", bank: "Kotak", date: "2026-11-01", status: "held", receivedOn: "2026-11-01", ...cheque }, ...over,
});
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => chequeAction.mockClear());

describe("a cheque's stages", () => {
  it("shows a received cheque at its first step and says to deposit it; deposit then clear", async () => {
    wrap(<ChequeCard row={row()} />);
    const card = screen.getByLabelText("Cheque");
    expect(card).toHaveTextContent("Cheque 000412");
    expect(card).toHaveTextContent("received, in hand");
    expect(card).toHaveTextContent(/Next: deposit it at the bank/);
    const stages = within(card).getByLabelText("Cheque stages");
    expect(stages).toHaveTextContent("Received · 1 Nov 2026");
    expect(stages).toHaveTextContent("Deposited");
    expect(stages).toHaveTextContent("Cleared");

    await userEvent.click(within(card).getByRole("button", { name: "Deposit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Into account")).toHaveValue("b1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark deposited" }));
    expect(chequeAction).toHaveBeenCalledWith("p1", expect.objectContaining({ action: "deposited", on: expect.any(String) }));
    expect(chequeAction.mock.calls[0][1]).not.toHaveProperty("account"); // the voucher's own bank: nothing to change
  });

  it("a deposited cheque can be marked cleared on a day, or returned with a reason", async () => {
    wrap(<ChequeCard row={row({}, { status: "deposited", depositedOn: "2026-11-03" })} />);
    const card = screen.getByLabelText("Cheque");
    expect(card).toHaveTextContent("deposited");
    expect(within(card).getByLabelText("Cheque stages")).toHaveTextContent("Deposited · 3 Nov 2026");
    expect(within(card).queryByRole("button", { name: "Deposit" })).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Cleared" }));
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Into account")).not.toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText("Cleared on"));
    await userEvent.type(within(dialog).getByLabelText("Cleared on"), "2026-11-05");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark cleared" }));
    expect(chequeAction).toHaveBeenLastCalledWith("p1", { action: "cleared", on: "2026-11-05" });

    await userEvent.click(within(card).getByRole("button", { name: "Returned" }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Record the return" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Reason on the memo *"), "Funds insufficient");
    await userEvent.type(within(dialog).getByLabelText("Bank's charges (₹)"), "250");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record the return" }));
    expect(chequeAction).toHaveBeenLastCalledWith("p1", expect.objectContaining({ action: "bounced", reason: "Funds insufficient", charges: 250 }));
  });

  it("a cleared or returned cheque offers nothing more, and the stages read from our side", () => {
    wrap(<ChequeCard row={row({}, { status: "cleared", depositedOn: "2026-11-03", clearedOn: "2026-11-05" })} />);
    const card = screen.getByLabelText("Cheque");
    expect(within(card).getByLabelText("Cheque stages")).toHaveTextContent("Cleared · 5 Nov 2026");
    expect(within(card).queryAllByRole("button")).toHaveLength(0);
    expect(chequeStageLabel("held", "payment")).toBe("held, not yet presented");
    expect(chequeStageLabel("deposited", "payment")).toBe("issued");
    expect(chequeStageLabel("bounced", "receipt")).toBe("returned");
  });
});
