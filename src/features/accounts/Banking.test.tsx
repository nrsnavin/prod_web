import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BankingTab } from "./BankingTab";
import type { Banking } from "./types";

// Every account at a glance, an account added where it is seen, and the
// cheques in hand deposited in one go with a slip to print.

const banking: Banking = {
  totals: { bank: 245000, cash: 30000, card: -4720, chequesInHand: 45500 },
  accounts: [
    { _id: "k", name: "Kotak CA", kind: "bank", bankName: "Kotak Mahindra Bank", accountNo: "7612149219", ifsc: "KKBK0000492", isDefault: true, active: true, balance: 245000, chequesInHand: { count: 2, amount: 37500 }, chequesIssued: { count: 1, amount: 9000 }, notOnStatement: 14, lastStatement: "2026-10-31" },
    { _id: "c", name: "Cash box", kind: "cash", active: true, balance: 30000, chequesInHand: { count: 0, amount: 0 }, chequesIssued: { count: 0, amount: 0 }, notOnStatement: 0, lastStatement: null },
    { _id: "h", name: "HDFC Corporate Card", kind: "card", bankName: "HDFC", accountNo: "4421", active: true, balance: -4720, chequesInHand: { count: 0, amount: 0 }, chequesIssued: { count: 0, amount: 0 }, notOnStatement: 1, lastStatement: null },
  ] as Banking["accounts"],
  inHand: [
    { _id: "p1", voucherNo: "RCT/2026-27/0011", receivedOn: "2026-11-05", amount: 25000, partyName: "Sunrise Garments", account: "k", accountName: "Kotak CA", chequeNo: "125000", bank: "Indian Bank", chequeDate: "2026-11-05", due: true },
    { _id: "p2", voucherNo: "RCT/2026-27/0012", receivedOn: "2026-11-05", amount: 12500, partyName: "Kumar Knits", account: "k", accountName: "Kotak CA", chequeNo: "112500", bank: "SBI", chequeDate: "2026-11-06", due: true },
    { _id: "p3", voucherNo: "RCT/2026-27/0013", receivedOn: "2026-11-05", amount: 8000, partyName: "Chennai Trims", account: "k", accountName: "Kotak CA", chequeNo: "108000", bank: "IOB", chequeDate: "2026-11-20", due: false },
  ],
};

const depositMutate = vi.fn();
let role = "admin";
vi.mock("./hooks", () => ({
  useBanking: () => ({ data: banking, isLoading: false }),
  useDeposits: () => ({ data: { slips: [{ _id: "s0", slipNo: "DEP/2026-27/0001", date: "2026-11-01", account: "k", accountName: "Kotak CA", cheques: [{}], cash: 5000, total: 15000 }] } }),
  useAccountsMutations: () => ({ createDeposit: { mutate: depositMutate, isPending: false }, saveBankAccount: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
const wrap = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={["/accounts/banking"]}>
      <Routes><Route path="*" element={<><BankingTab /><Where /></>} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => { depositMutate.mockReset(); role = "admin"; });

describe("banking", () => {
  it("shows every account with what is in it, waiting on it, and owed on a card", () => {
    wrap();
    const totals = screen.getByLabelText("Totals");
    expect(totals).toHaveTextContent("In the bank₹2,45,000.00");
    expect(totals).toHaveTextContent("Cheques in hand₹45,500.00");
    expect(totals).toHaveTextContent("Owed on cards₹4,720.00");
    const kotak = screen.getByLabelText("Kotak CA");
    expect(kotak).toHaveTextContent("Bank · Kotak Mahindra Bank · …9219 · KKBK0000492");
    expect(kotak).toHaveTextContent("2 cheques in hand, not deposited · ₹37,500.00");
    expect(kotak).toHaveTextContent("1 cheque issued, not cleared · ₹9,000.00");
    expect(kotak).toHaveTextContent("14 not yet on a bank statement");
    const card = screen.getByLabelText("HDFC Corporate Card");
    expect(card).toHaveTextContent("₹4,720.00owed");
    expect(within(card).queryByRole("button", { name: /Receive/ })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Pay card bill/ })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Cash box")).queryByRole("button", { name: /Deposit/ })).not.toBeInTheDocument();
  });

  it("opens the right form for the account: receive into it, transfer from it, its own book", async () => {
    wrap();
    const kotak = screen.getByLabelText("Kotak CA");
    await userEvent.click(within(kotak).getByRole("button", { name: /Receive/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts/vouchers?new=receipt&account=k");
    await userEvent.click(within(screen.getByLabelText("HDFC Corporate Card")).getByRole("button", { name: /Pay card bill/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/accounts/vouchers?new=contra&to=h");
    expect(within(kotak).getByRole("link", { name: /Transactions/ })).toHaveAttribute("href", "/accounts/reports?report=cashbook&account=k");
  });

  it("an account is added right here, by an admin", async () => {
    wrap();
    await userEvent.click(screen.getByRole("button", { name: /Add an account/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("New account");
    role = "accounts";
  });

  it("is read-only for anyone else", () => {
    role = "accounts";
    wrap();
    expect(screen.queryByRole("button", { name: /Add an account/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Kotak CA" })).not.toBeInTheDocument();
  });

  it("deposits the cheques ticked, and cash too, into the bank in one go", async () => {
    wrap();
    const list = screen.getByLabelText("Cheques in hand");
    // A cheque dated ahead cannot be ticked.
    expect(within(list).getByLabelText("Deposit cheque 108000")).toBeDisabled();
    await userEvent.click(within(list).getByRole("button", { name: "Tick all due (2)" }));
    await userEvent.click(within(list).getByRole("button", { name: "Deposit 2 · ₹37,500.00" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Into *")).toHaveValue("k");
    await userEvent.type(within(dialog).getByLabelText(/Cash too/), "20000");
    expect(dialog).toHaveTextContent("Cash box holds ₹30,000.00");
    await userEvent.type(within(dialog).getByLabelText("Bank's slip no."), "448812");
    await userEvent.click(within(dialog).getByRole("button", { name: "Deposit ₹57,500.00" }));
    expect(depositMutate.mock.calls[0][0]).toMatchObject({ account: "k", cheques: ["p1", "p2"], cash: 20000, cashFrom: "c", bankSlipNo: "448812" });
  });

  it("refuses more cash than the box holds, and lists the slips to print again", async () => {
    wrap();
    await userEvent.click(within(screen.getByLabelText("Kotak CA")).getByRole("button", { name: /Deposit/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Cash too/), "50000");
    expect(dialog).toHaveTextContent("Cash box has only ₹30,000.00");
    expect(within(dialog).getByRole("button", { name: /Deposit ₹/ })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("link", { name: "Print DEP/2026-27/0001" })).toHaveAttribute("href", "/api/v2/accounts/deposits/s0/pdf");
  });
});
