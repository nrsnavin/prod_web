import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartyOpening } from "./PartyOpening";
import type { OpeningBalance } from "./types";

// On a customer's or supplier's own page: what they owed on the day the
// books started here, and the form to enter it with the party fixed.

const createMutate = vi.fn();
const cancelMutate = vi.fn();
let rows: OpeningBalance[] = [];
vi.mock("./hooks", () => ({
  useOpeningBalances: () => ({ data: { rows, total: rows.length, page: 1, pages: 1, totals: { customer: { due: 0, advance: 0 }, supplier: { due: 0, advance: 0 } } }, isLoading: false, isError: false }),
  useAccountsMutations: () => ({ createOpening: { mutate: createMutate, isPending: false }, cancelOpening: { mutate: cancelMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const ob = (over: Partial<OpeningBalance>): OpeningBalance => ({
  _id: "ob1", docNo: "OB/2026-27/0001", partyType: "customer", customer: "c1", partyName: "Sunrise", kind: "due", refNo: "INV-1182", date: "2026-03-12", dueDate: "2026-04-11",
  amount: 48500, settledAmount: 0, unapplied: 0, status: "posted", ...over,
});

beforeEach(() => { createMutate.mockReset(); cancelMutate.mockReset(); rows = []; });

describe("a party's opening balance", () => {
  it("says there is none, and posts one for this party without asking who", async () => {
    render(<PartyOpening partyType="customer" party="c1" name="Sunrise" />);
    const card = screen.getByLabelText("Opening balance");
    expect(card).toHaveTextContent(/No opening balance entered. If Sunrise owed anything/);
    await userEvent.click(within(card).getByRole("button", { name: /add opening balance/i }));
    expect(screen.getByText("Opening balance for Sunrise")).toBeInTheDocument();
    expect(screen.getByLabelText("Party")).toHaveTextContent("Customer Sunrise");
    expect(screen.queryByLabelText(/party type/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Old bill / ref no."), "INV-1182");
    await userEvent.type(screen.getByLabelText("Bill date *"), "2026-03-12");
    await userEvent.type(screen.getByLabelText("Amount *"), "48500");
    await userEvent.click(screen.getByRole("button", { name: /post balance/i }));
    expect(createMutate.mock.calls[0][0]).toEqual({ partyType: "customer", party: "c1", kind: "due", refNo: "INV-1182", date: "2026-03-12", dueDate: undefined, amount: 48500 });
  });

  it("lists what was brought over, totals it, and lets an untouched row be cancelled", async () => {
    rows = [ob({}), ob({ _id: "ob2", docNo: "OB/2026-27/0002", kind: "advance", amount: 5000, unapplied: 5000, refNo: "" }), ob({ _id: "ob3", docNo: "OB/2026-27/0003", amount: 10000, settledAmount: 4000 })];
    render(<PartyOpening partyType="customer" party="c1" name="Sunrise" />);
    const card = screen.getByLabelText("Opening balance");
    expect(card).toHaveTextContent("owed us ₹58,500.00 · still open ₹54,500.00 · paid ahead ₹5,000.00 · unused ₹5,000.00");
    expect(within(card).getAllByRole("row")).toHaveLength(4);
    expect(within(card).getByText("They paid ahead")).toBeInTheDocument();
    // The row with a receipt against it cannot be cancelled from here.
    expect(within(card).queryByRole("button", { name: "Cancel OB/2026-27/0003" })).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Cancel OB/2026-27/0001" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Entered against the wrong customer");
    await userEvent.click(within(dialog).getByRole("button", { name: /cancel balance/i }));
    expect(cancelMutate.mock.calls[0][0]).toEqual({ id: "ob1", reason: "Entered against the wrong customer" });
  });

  it("words a supplier's balance from our side", () => {
    rows = [ob({ partyType: "supplier", supplier: "s1", customer: undefined, partyName: "Sri Yarn", amount: 32150 })];
    render(<PartyOpening partyType="supplier" party="s1" name="Sri Yarn" />);
    const card = screen.getByLabelText("Opening balance");
    expect(card).toHaveTextContent("we owed ₹32,150.00");
    expect(within(card).getByText("We owe them")).toBeInTheDocument();
  });
});
