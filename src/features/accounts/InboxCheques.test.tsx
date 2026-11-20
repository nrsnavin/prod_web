import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { InboxTab } from "./InboxTab";
import type { Inbox, Overview } from "./types";

// "Cheques to deposit" listed every held cheque whose date had come: the
// ones received (in the drawer, to be banked) and the post-dated ones we
// gave suppliers (which the bank will pay out) — added into one figure.
// The server now sends the two apart; the screen keeps them apart.

const received = (id: string, party: string, amount: number, date: string) =>
  ({ _id: id, kind: "receipt" as const, voucherNo: `RV/${id}`, partyName: party, amount, cheque: { number: `10${id}`, bank: "HDFC", date } });
const given = (id: string, party: string, amount: number, date: string) =>
  ({ _id: id, kind: "payment" as const, voucherNo: `PV/${id}`, partyName: party, amount, cheque: { number: `50${id}`, bank: "", date } });

const base: Inbox = {
  billsDue: { count: 0, overdue: 0, amount: 0, top: [] },
  approvals: { count: 0, amount: 0, top: [] },
  claimsToPay: { count: 0, amount: 0, top: [] },
  bankLines: { count: 0, amount: 0 },
  toChase: { count: 0, amount: 0, top: [] },
  promisesDue: { count: 0, top: [] },
  variances: { count: 0, top: [] },
};
let inbox: Inbox;
const overview: Overview = {
  receivables: { total: 0, overdue: 0, count: 0, ageing: { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 }, top: [] },
  payables: { total: 0, overdue: 0, count: 0, paidAhead: 0, ageing: { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 }, top: [] },
  accounts: [], pendingExpenses: 0,
  month: { from: "2026-10-01", to: "2026-10-31", current: false, expenses: { amount: 0, count: 0 }, sales: { amount: 0, outputTax: 0, count: 0 }, purchases: { amount: 0, inputCredit: 0, count: 0 } },
  recentPayments: [],
};
vi.mock("./api", () => ({ accountsService: { inbox: async () => inbox, whatsappPapers: async () => ({ success: true, papers: [], waiting: 0 }) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock("./hooks", async (orig) => ({ ...(await orig<typeof import("./hooks")>()), useOverview: () => ({ data: overview, isLoading: false, isError: false, error: null }) }));

const show = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><InboxTab /></MemoryRouter></QueryClientProvider>);

beforeEach(() => {
  inbox = {
    ...base,
    chequesDue: {
      count: 26, amount: 30000, overdue: 25,
      top: [received("1", "Apex Garments", 1000, "2026-11-19"), received("2", "Zenith Exports", 5000, "2026-11-23")],
      issued: { count: 2, amount: 52000, top: [given("7", "Rubber Thread India", 40000, "2026-11-21"), given("8", "Sri Yarn Traders", 12000, "2026-11-24")] },
    },
  };
});

describe("cheques on the accounts inbox", () => {
  it("to deposit: the ones received, and their own count and amount", async () => {
    show();
    const box = await screen.findByLabelText("Cheques to deposit");
    expect(within(box).getByText("26")).toBeInTheDocument();
    expect(within(box).getByText("₹30,000.00")).toBeInTheDocument();
    expect(within(box).getByText("25 past their date")).toBeInTheDocument();
    expect(within(box).getByRole("link", { name: "Apex Garments" })).toHaveAttribute("href", "/accounts/payments/1");
    expect(within(box).getByText(/Cheque 101 · HDFC · dated 19 Nov 2026/)).toBeInTheDocument();
    // What we gave a supplier is not money to bank.
    expect(within(box).queryByText("Rubber Thread India")).not.toBeInTheDocument();
    expect(within(box).queryByText(/issued/)).not.toBeInTheDocument();
  });

  it("the ones we gave, falling due, are a box of their own", async () => {
    show();
    const box = await screen.findByLabelText("Our cheques falling due");
    expect(within(box).getByText("2")).toBeInTheDocument();
    expect(within(box).getByText("₹52,000.00")).toBeInTheDocument();
    expect(within(box).getByRole("link", { name: "Rubber Thread India" })).toHaveAttribute("href", "/accounts/payments/7");
    expect(within(box).getByText(/Cheque 507 · dated 21 Nov 2026/)).toBeInTheDocument();
    expect(within(box).getByText("₹40,000.00")).toBeInTheDocument();
    expect(within(box).getByText("₹12,000.00")).toBeInTheDocument();
    expect(within(box).queryByText("Apex Garments")).not.toBeInTheDocument();
    // It opens the cheque register, as the other box does.
    expect(within(box).getByRole("link", { name: /Our cheques falling due/ })).toHaveAttribute("href", "/accounts/registers?section=cheques");
  });

  it("no box for our own cheques when none falls due", async () => {
    inbox = { ...inbox, chequesDue: { ...inbox.chequesDue!, issued: { count: 0, amount: 0, top: [] } } };
    show();
    await screen.findByLabelText("Cheques to deposit");
    expect(screen.queryByLabelText("Our cheques falling due")).not.toBeInTheDocument();
  });

  it("an answer without the new figure (an older server) still shows the cheques it lists, saying which were ours", async () => {
    inbox = { ...base, chequesDue: { count: 2, amount: 41000, overdue: 0, top: [received("1", "Apex Garments", 1000, "2026-11-19"), given("7", "Rubber Thread India", 40000, "2026-11-21")] } };
    show();
    const box = await screen.findByLabelText("Cheques to deposit");
    expect(within(box).getByText("Apex Garments")).toBeInTheDocument();
    expect(within(box).getByText(/Cheque 507 · dated 21 Nov 2026 · issued by us/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Our cheques falling due")).not.toBeInTheDocument();
  });
});
