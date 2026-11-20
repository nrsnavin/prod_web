import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RegistersTab } from "./RegistersTab";
import type { FixedAssetRegister, PdcRegister, PdcRow } from "./types";

// The cheque register counted every held cheque as one to deposit — the
// ones received and the post-dated ones we gave. And an asset brought in
// with its written-down value lost that value when its year was typed
// in a way the server did not take: saved at full cost, nothing said.

const register: FixedAssetRegister = {
  fy: "2026-27", from: "2026-04-01", to: "2027-03-31", rows: [], blocks: [],
  totals: { cost: 0, caOpening: 0, caDep: 0, caClosing: 0, itOpening: 0, itDep: 0, itClosing: 0, additions: 0, disposals: 0 },
  journal: null, journalStale: false, timingDifference: 0,
  blockTable: [{ key: "plant", label: "Plant & machinery", itRate: 15, life: 15 }],
};
const cheque = (id: string, kind: PdcRow["kind"], party: string, status: PdcRow["cheque"]["status"] = "held"): PdcRow =>
  ({ _id: id, kind, voucherNo: `V/${id}`, date: "2026-11-01", partyType: kind === "receipt" ? "customer" : "supplier", partyName: party, amount: 1000, accountName: "Kotak CA", reference: "", cheque: { number: `10${id}`, bank: "Kotak", date: "2026-11-10", status }, allocations: [], status: "posted" });
let pdc: PdcRegister;
const addFixedAsset = vi.fn().mockResolvedValue({ success: true, asset: {} });
vi.mock("./api", () => ({
  accountsService: {
    fixedAssets: async () => register, fixedAssetsXlsxUrl: () => "/x.xlsx", addFixedAsset: (...a: unknown[]) => addFixedAsset(...a),
    pdc: async () => pdc, chequeAction: vi.fn(),
  },
}));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useCategories: () => ({ data: [] }),
  useBankAccounts: () => ({ data: [{ _id: "b1", name: "Kotak CA", kind: "bank", active: true, isDefault: true }] }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const at = (url: string) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><RegistersTab /></MemoryRouter></QueryClientProvider>);

beforeEach(() => {
  addFixedAsset.mockClear();
  pdc = {
    status: "held", total: 2,
    rows: [cheque("1", "receipt", "Sunrise Garments"), cheque("7", "payment", "Sri Yarns")],
    totals: {
      held: { count: 7, received: 15000, issued: 61000, receivedCount: 4, issuedCount: 3 },
      dueToday: { count: 2, amount: 3000, issued: { count: 1, amount: 40000 } },
      dueThisWeek: { count: 3, amount: 8000, issued: { count: 2, amount: 52000 } },
    },
  };
});

describe("the cheque register's summary", () => {
  it("counts the cheques in the drawer, and ours held to their date, apart", async () => {
    at("/accounts/registers?section=cheques");
    await screen.findByRole("table", { name: "Cheque register" });
    const line = screen.getByLabelText("Cheques held");
    // Before: "In hand: 7 cheques … 3 to deposit (₹43,000.00)" — ours among them.
    expect(line).toHaveTextContent("In hand: 4 cheques · received ₹15,000.00");
    expect(line).toHaveTextContent("ours, held to their date: 3 · ₹61,000.00");
    expect(line).toHaveTextContent("2 to deposit (₹3,000.00)");
    expect(line).toHaveTextContent("1 of ours due (₹40,000.00)");
  });

  it("reads an answer without the split as before", async () => {
    pdc = { ...pdc, total: undefined, totals: { held: { count: 1, received: 50000, issued: 0 }, dueToday: { count: 1, amount: 50000 }, dueThisWeek: { count: 1, amount: 50000 } } };
    at("/accounts/registers?section=cheques");
    await screen.findByRole("table", { name: "Cheque register" });
    const line = screen.getByLabelText("Cheques held");
    expect(line).toHaveTextContent("In hand: 1 cheque · received ₹50,000.00 · issued ₹0.00");
    expect(line).toHaveTextContent("1 to deposit (₹50,000.00)");
    expect(line).not.toHaveTextContent("of ours due");
  });

  it("says so when the list is not all of them", async () => {
    pdc = { ...pdc, status: "cleared", total: 505, rows: [cheque("1", "receipt", "Sunrise Garments", "cleared")] };
    at("/accounts/registers?section=cheques");
    await screen.findByRole("table", { name: "Cheque register" });
    expect(screen.getByText("Showing the newest 1 of 505.")).toBeInTheDocument();
  });

  it("says nothing of the kind when it is", async () => {
    at("/accounts/registers?section=cheques");
    await screen.findByRole("table", { name: "Cheque register" });
    expect(screen.queryByText(/^Showing the/)).not.toBeInTheDocument();
  });
});

describe("an asset brought in with its written-down value", () => {
  const open = async () => {
    at("/accounts/registers");
    await userEvent.click(await screen.findByRole("button", { name: /Add asset/ }));
    const form = await screen.findByRole("dialog");
    await userEvent.type(within(form).getByLabelText("Asset *"), "Old compressor");
    await userEvent.type(within(form).getByLabelText("Cost capitalised (₹) *"), "500000");
    await userEvent.click(within(form).getByText(/Bought before these books began/));
    return form;
  };
  const add = (form: HTMLElement) => within(form).getByRole("button", { name: "Add asset" });

  it("is not saved while the year is not a financial year", async () => {
    const form = await open();
    await userEvent.type(within(form).getByLabelText("WDV, Companies Act (₹)"), "300000");
    // A value with no year: before, the asset was saved without it.
    expect(within(form).getByText("Say which year the opening values are as at the start of, like 2026-27.")).toBeInTheDocument();
    expect(add(form)).toBeDisabled();
    await userEvent.type(within(form).getByLabelText("As at the start of"), "2026");
    expect(within(form).getByText("2026 is not a financial year. Write it like 2026-27.")).toBeInTheDocument();
    expect(add(form)).toBeDisabled();
    await userEvent.type(within(form).getByLabelText("As at the start of"), "-28");
    expect(within(form).getByText("2026-28 is not a financial year. Write it like 2026-27.")).toBeInTheDocument();
    expect(add(form)).toBeDisabled();
    expect(addFixedAsset).not.toHaveBeenCalled();
  });

  it("is saved with it when the year is one", async () => {
    const form = await open();
    await userEvent.type(within(form).getByLabelText("As at the start of"), "2026-27");
    // A year with no value is the same slip, the other way round.
    expect(within(form).getByText("Enter the written-down value as at the start of 2026-27.")).toBeInTheDocument();
    expect(add(form)).toBeDisabled();
    await userEvent.type(within(form).getByLabelText("WDV, Companies Act (₹)"), "300000");
    expect(add(form)).toBeEnabled();
    await userEvent.click(add(form));
    expect(addFixedAsset).toHaveBeenCalledWith(expect.objectContaining({ name: "Old compressor", cost: 500000, openingWdv: { fy: "2026-27", companiesAct: 300000, incomeTax: undefined } }));
  });

  it("needs neither when the asset is new (unchanged)", async () => {
    const form = await open();
    expect(add(form)).toBeEnabled();
    await userEvent.click(add(form));
    expect(addFixedAsset).toHaveBeenCalledWith(expect.not.objectContaining({ openingWdv: expect.anything() }));
  });
});

describe("a year in the link", () => {
  it("is taken when it is a financial year, and not when it only looks like one", async () => {
    at("/accounts/registers?fy=2025-26");
    expect(await screen.findByLabelText("Year")).toHaveValue("2025-26");
  });
});
