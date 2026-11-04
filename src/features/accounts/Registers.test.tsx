import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RegistersTab } from "./RegistersTab";
import type { BudgetCompare, FixedAssetRegister, PdcRegister } from "./types";

const year = (dep: number, close: number) => ({ fy: "2026-27", days: 182, fraction: 0.499, halfRate: false, companiesAct: { opening: 1000000, depreciation: dep, closing: close, rate: 18.1, method: "wdv" as const }, incomeTax: { opening: 1000000, depreciation: 150000, closing: 850000, rate: 15 }, disposal: null });
const register: FixedAssetRegister = {
  fy: "2026-27", from: "2026-04-01", to: "2027-03-31",
  rows: [{ _id: "fa1", assetNo: "FA/2026-27/0001", name: "Needle loom 12", block: "plant", method: "wdv", residualPercent: 5, purchaseDate: "2026-09-20", putToUse: "2026-10-01", cost: 1000000, supplierName: "Muller", status: "active", year: year(90251.3, 909748.7), blockLabel: "Plant & machinery", addedThisYear: true }],
  blocks: [{ block: "plant", label: "Plant & machinery", itRate: 15, count: 1, cost: 1000000, caOpening: 1000000, caDep: 90251.3, caClosing: 909748.7, itOpening: 1000000, itDep: 150000, itClosing: 850000 }],
  totals: { cost: 1000000, caOpening: 1000000, caDep: 90251.3, caClosing: 909748.7, itOpening: 1000000, itDep: 150000, itClosing: 850000, additions: 1000000, disposals: 0 },
  journal: null, journalStale: false, timingDifference: -59748.7,
  blockTable: [{ key: "plant", label: "Plant & machinery", itRate: 15, life: 15 }, { key: "computer", label: "Computers", itRate: 40, life: 3 }],
};
let registerNow = register;
const postDepreciation = vi.fn().mockImplementation(async () => { registerNow = { ...register, journal: { _id: "j1", journalNo: "JV/2026-27/0009", date: "2027-03-31", total: 90251.3 } }; return { success: true, journal: { journalNo: "JV/2026-27/0009", total: 90251.3 }, register: registerNow }; });
const pdc: PdcRegister = {
  status: "held",
  rows: [{ _id: "p1", kind: "receipt", voucherNo: "RCT/2026-27/0014", date: "2026-11-01", partyType: "customer", partyName: "Sunrise Garments", amount: 50000, accountName: "Kotak CA", reference: "000412", cheque: { number: "000412", bank: "Kotak", date: "2026-11-10", status: "held" }, allocations: [{ docNo: "INV/2026-27/0001" }], status: "posted" }],
  totals: { held: { count: 1, received: 50000, issued: 0 }, dueToday: { count: 0, amount: 0 }, dueThisWeek: { count: 1, amount: 50000 } },
};
const chequeAction = vi.fn().mockResolvedValue({ success: true, payment: {} });
const budgets: BudgetCompare = {
  fy: "2026-27", from: "2026-04-01", to: "2027-03-31", months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"], elapsed: 8,
  rows: [{ category: "c1", name: "Electricity", ledger: "", active: true, budget: Array(12).fill(10000), actual: [9000, 12500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], budgetTotal: 120000, actualTotal: 21500, ytdBudget: 80000, ytdActual: 21500, variance: 58500, used: 26.9, overMonths: ["May"], state: "ok", projected: 32250, note: "", count: 2 }],
  totals: { budgetTotal: 120000, actualTotal: 21500, ytdBudget: 80000, ytdActual: 21500, variance: 58500, over: 0, near: 0, unbudgeted: 0 },
};
const saveBudgets = vi.fn().mockResolvedValue(budgets);
vi.mock("./api", () => ({
  accountsService: {
    fixedAssets: async () => registerNow, fixedAssetsXlsxUrl: (fy: string) => `/api/v2/accounts/fixed-assets/register.xlsx?fy=${fy}`, postDepreciation: (...a: unknown[]) => postDepreciation(...a),
    pdc: async () => pdc, chequeAction: (...a: unknown[]) => chequeAction(...a),
    budgets: async () => budgets, saveBudgets: (...a: unknown[]) => saveBudgets(...a),
  },
}));
vi.mock("./hooks", () => ({ ACCOUNTS_KEY: "accounts", useCategories: () => ({ data: [{ _id: "c1", name: "Electricity" }, { _id: "c2", name: "Rent" }] }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("the registers tab", () => {
  it("shows the fixed asset register under both acts and posts the year's depreciation", async () => {
    wrap(<RegistersTab />);
    const table = await screen.findByRole("table", { name: "Fixed asset register" });
    const row = within(table).getByText("Needle loom 12").closest("tr")!;
    expect(row).toHaveTextContent("Plant & machinery");
    expect(row).toHaveTextContent("WDV 18.1% · IT 15%");
    expect(row).toHaveTextContent("90,251.30");
    expect(row).toHaveTextContent("1,50,000.00");
    expect(screen.getByText("Depreciation not posted for 2026-27")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Post depreciation journal" }));
    expect(postDepreciation).toHaveBeenCalledWith("2026-27");
    expect(await screen.findByText(/JV\/2026-27\/0009/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Register \(Excel\)/ })).toHaveAttribute("href", "/api/v2/accounts/fixed-assets/register.xlsx?fy=2026-27");
  });

  it("lists cheques in hand and marks one deposited", async () => {
    wrap(<RegistersTab />);
    await userEvent.click(screen.getByRole("button", { name: "Cheques" }));
    const table = await screen.findByRole("table", { name: "Cheque register" });
    const row = within(table).getByText("000412").closest("tr")!;
    expect(row).toHaveTextContent("Sunrise Garments");
    expect(row).toHaveTextContent("50,000.00");
    expect(row).toHaveTextContent("in hand");
    expect(screen.getByText(/In the drawer: 1 cheque · received ₹50,000.00/)).toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: "Deposited" }));
    expect(chequeAction).toHaveBeenCalledWith("p1", expect.objectContaining({ action: "deposited" }));
  });

  it("compares budget with actual per head and saves a year's figure", async () => {
    wrap(<RegistersTab />);
    await userEvent.click(screen.getByRole("button", { name: "Budgets" }));
    const table = await screen.findByRole("table", { name: "Budgets" });
    const row = within(table).getByText("Electricity").closest("tr")!;
    expect(row).toHaveTextContent("80,000.00");
    expect(row).toHaveTextContent("21,500.00");
    expect(row).toHaveTextContent("26.9%");
    expect(row).toHaveTextContent("May");
    const input = within(row).getByLabelText("Budget for Electricity");
    await userEvent.clear(input);
    await userEvent.type(input, "150000");
    await userEvent.click(screen.getByRole("button", { name: "Save budgets" }));
    expect(saveBudgets).toHaveBeenCalledWith("2026-27", [{ category: "c1", annual: 150000 }]);
  });
});
