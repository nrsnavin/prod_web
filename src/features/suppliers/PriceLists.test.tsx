import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupplierRates } from "./SupplierRates";
import { PoCreatePage } from "./PoCreatePage";
import type { PriceListResult, RateFlag, Supplier, SupplierRate } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHAT A SUPPLIER QUOTED, AND A PO ABOVE IT
//
//  Their live rates are listed on their page, a lapsed one marked. Their
//  price list is read into lines put against our materials; the lines
//  kept become the live rates, with the read's id. A paper carrying
//  someone else's GSTIN is said. On a new PO, a line above the quoted
//  rate is flagged under that line; the PO is not stopped for it.
// ══════════════════════════════════════════════════════════════════

const rates = vi.fn();
const read = vi.fn();
const save = vi.fn();
const check = vi.fn();
vi.mock("./api", () => ({
  priceListService: { rates: (...a: unknown[]) => rates(...a), read: (...a: unknown[]) => read(...a), save: (...a: unknown[]) => save(...a), check: (...a: unknown[]) => check(...a) },
  supplierService: { list: async () => ({ suppliers: [{ _id: "s1", name: "Sri Yarn Traders" }], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } }) },
}));
vi.mock("@/features/materials/hooks", () => ({
  useMaterials: () => ({ isLoading: false, data: [
    { _id: "m1", name: "Nylon 70D/24F SD", category: "yarn", unit: "kg" },
    { _id: "m2", name: "Spandex 840D", category: "rubber", unit: "kg" },
    { _id: "m3", name: "Polyester 150D", category: "yarn", unit: "kg" },
  ] }),
}));
const createPo = vi.fn();
vi.mock("./hooks", () => ({ usePoMutations: () => ({ create: { mutate: createPo, isPending: false } }) }));
vi.mock("@/components/ui/UnsavedChangesGuard", () => ({ UnsavedChangesGuard: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const supplier: Supplier = { _id: "s1", name: "Sri Yarn Traders", gstin: "33AAAPS0001F1Z5" };
const rate = (over: Partial<SupplierRate>): SupplierRate => ({ _id: "r1", supplier: "s1", supplierName: "Sri Yarn Traders", rawMaterial: "m1", materialName: "Nylon 70D/24F SD", description: "Nylon 70D semi-dull", rate: 305, unit: "kg", gstPercent: 5, minQty: null, source: "price_list", ref: "PL-Dec", quotedOn: "2026-11-01", validUntil: "2099-12-31", ...over });
const photo = () => new File(["x"], "list.jpg", { type: "image/jpeg" });
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

const readResult = (over: Partial<PriceListResult> = {}): PriceListResult => ({
  read: { problem: null, kind: "quotation", supplierName: "Sri Yarn Traders", supplierGstin: "33AAAPS0001F1Z5", ref: "Q/118", date: "2026-11-01", validUntil: "2026-11-30" },
  supplier: { _id: "s1", name: "Sri Yarn Traders", matchedBy: "picked" },
  rows: [
    { description: "Nylon 70D/24F SD", rate: 310, unit: "kg", gstPercent: 5, minQty: 100, rawMaterial: "m1", materialName: "Nylon 70D/24F SD", candidates: [{ id: "m1", name: "Nylon 70D/24F SD", score: 0.97 }], current: { rate: 305, unit: "kg", ref: "PL-Dec", quotedOn: "2026-11-01" }, change: 1.64 },
    { description: "Spandex 840D", rate: 900, unit: "kg", gstPercent: 5, minQty: null, rawMaterial: "m2", materialName: "Spandex 840D", candidates: [{ id: "m2", name: "Spandex 840D", score: 0.99 }], current: null, change: null },
    { description: "Something else entirely", rate: 5, unit: "pcs", gstPercent: null, minQty: null, rawMaterial: null, materialName: null, candidates: [], current: null, change: null },
  ],
  aiSuggestion: "ai-pl-1",
  ...over,
});

beforeEach(() => {
  for (const f of [rates, read, save, check, createPo]) f.mockReset();
  rates.mockResolvedValue([]);
  save.mockResolvedValue({ success: true, saved: 2, replaced: 1 });
  check.mockResolvedValue([]);
});

describe("the rates a supplier quoted", () => {
  it("lists the live rates, a lapsed one marked", async () => {
    rates.mockResolvedValue([rate({}), rate({ _id: "r2", rawMaterial: "m2", materialName: "Spandex 840D", description: "Spandex 840D", rate: 900, source: "quotation", ref: "Q/90", validUntil: "2026-01-31" })]);
    wrap(<SupplierRates supplier={supplier} />);
    const table = await screen.findByRole("table", { name: "Their live rates" });
    const nylon = within(table).getByText("Nylon 70D/24F SD").closest("tr")!;
    expect(nylon).toHaveTextContent("305/kg");
    expect(nylon).toHaveTextContent("price list PL-Dec");
    expect(nylon).toHaveTextContent("“Nylon 70D semi-dull”");
    expect(within(table).getByText("Spandex 840D").closest("tr")).toHaveTextContent("lapsed");
    expect(rates).toHaveBeenCalledWith("s1");
  });

  it("their price list is read into lines on our materials; the lines kept are saved with the read", async () => {
    read.mockResolvedValue(readResult());
    wrap(<SupplierRates supplier={supplier} />);
    await userEvent.click(await screen.findByRole("button", { name: /read a price list or quotation/i }));
    await userEvent.upload(screen.getByLabelText("Price list photo"), photo());
    const lines = await screen.findByLabelText("Lines quoted");
    expect(read).toHaveBeenCalledWith([expect.any(File)], "s1");
    expect(screen.getByLabelText("Their reference")).toHaveValue("Q/118");
    expect(screen.getByLabelText("Good till")).toHaveValue("2026-11-30");
    // The line already quoted shows the live rate and how far it moved.
    expect(lines).toHaveTextContent("Now ₹305/kg (PL-Dec) · +1.64%");
    // The line put against no material is not kept until one is chosen.
    expect(screen.getByLabelText("Keep line 3")).not.toBeChecked();
    expect(screen.getByText("2 of 3 lines to keep")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Keep line 2"));
    expect(screen.getByText("1 of 3 lines to keep")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Keep line 2"));
    await userEvent.click(screen.getByRole("button", { name: "Keep these rates" }));
    expect(save).toHaveBeenCalledWith({
      supplier: "s1", source: "quotation", ref: "Q/118", quotedOn: "2026-11-01", validUntil: "2026-11-30", aiSuggestion: "ai-pl-1",
      rows: [
        { rawMaterial: "m1", rate: 310, unit: "kg", description: "Nylon 70D/24F SD", gstPercent: 5, minQty: 100 },
        { rawMaterial: "m2", rate: 900, unit: "kg", description: "Spandex 840D", gstPercent: 5, minQty: null },
      ],
    });
  });

  it("a paper with another GSTIN is said; with no reader, rates are typed in", async () => {
    read.mockResolvedValue(readResult({ read: { ...readResult().read, supplierGstin: "33ZZZZZ9999Z1Z9", supplierName: "Other Mills" } }));
    wrap(<SupplierRates supplier={supplier} />);
    await userEvent.click(await screen.findByRole("button", { name: /read a price list or quotation/i }));
    await userEvent.upload(screen.getByLabelText("Price list photo"), photo());
    expect(await screen.findByRole("alert")).toHaveTextContent("The paper carries GSTIN 33ZZZZZ9999Z1Z9 (Other Mills); Sri Yarn Traders's is 33AAAPS0001F1Z5");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: /type rates in/i }));
    const keep = await screen.findByRole("button", { name: "Keep these rates" });
    expect(keep).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Material for line 1"));
    await userEvent.click(await screen.findByRole("option", { name: /Polyester 150D/ }));
    await userEvent.type(screen.getByLabelText("Rate for line 1"), "182");
    await userEvent.click(keep);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ supplier: "s1", source: "manual", rows: [expect.objectContaining({ rawMaterial: "m3", rate: 182 })] }));
  });
});

describe("a new purchase order above what the supplier quoted", () => {
  it("flags the line under it, and still raises the PO", async () => {
    const flag: RateFlag = { code: "ABOVE_QUOTE", severity: "warning", line: 0, message: "Nylon 70D/24F SD at ₹320 is 4.92% above Sri Yarn Traders's price list PL-Dec of ₹305/kg" };
    check.mockResolvedValue([flag]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[{ pathname: "/purchase-orders/new", state: { prefill: { supplier: "s1", supplierName: "Sri Yarn Traders", items: [{ rawMaterial: "m1", quantity: 100, price: 320 }, { rawMaterial: "m2", quantity: 10, price: 900 }] } } }]}>
          <PoCreatePage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText(/is 4.92% above Sri Yarn Traders's price list PL-Dec/, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith("s1", [
      { rawMaterial: "m1", rate: 320, description: "Nylon 70D/24F SD" },
      { rawMaterial: "m2", rate: 900, description: "Spandex 840D" },
    ]);
    expect(screen.getByText("1 line is above what the supplier quoted.")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /create po/i })[0]);
    await waitFor(() => expect(createPo).toHaveBeenCalledTimes(1));
  });
});
