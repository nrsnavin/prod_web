import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/core/http/httpClient";
import { ElasticCostSheet } from "./ElasticCostSheet";
import type { CostSheet } from "./api";

// The cost sheet: each material's price and cost a metre, an old price
// marked, the total flagged when it is out of date; prices edited,
// previewed and saved.

const recalc = vi.fn();
const save = vi.fn();
let sheet: CostSheet | undefined;
vi.mock("./hooks", () => ({
  useCostSheet: () => ({ data: sheet, isLoading: false, isError: false, error: null }),
  useElasticMutations: () => ({
    recalculate: { mutate: recalc, isPending: false },
    saveCostSheet: { mutate: save, isPending: false },
  }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const line = (role: string, id: string, name: string, grams: number, price: number, extra: object = {}) => ({
  role, material: { id, name, category: "", unit: "kg" }, found: true, grams, price,
  cost: (price * grams) / 1000, costedRate: price, priceChanged: false, sharedWith: 0, ...extra,
});

const base = (): CostSheet => ({
  elasticId: "e1",
  name: "25mm Woven",
  lines: [
    line("Warp spandex", "rub", "Spandex 840D", 0.5, 900),
    line("Weft yarn", "weft", "Poly 300D", 0.4, 180),
    line("Warp yarn 1", "warp", "Poly 150D", 1.0, 260, { costedRate: 200, priceChanged: true, sharedWith: 3 }),
  ],
  now: { materialCost: 0.782, conversionCost: 1.5, totalCost: 2.282 },
  costed: { materialCost: 0.722, conversionCost: 1.5, totalCost: 2.222, at: "2026-10-01T00:00:00Z" },
  missing: 0,
  stale: true,
});

const renderSheet = () => render(<MemoryRouter><ElasticCostSheet elasticId="e1" /></MemoryRouter>);

beforeEach(() => {
  sheet = base();
  recalc.mockReset();
  save.mockReset();
  toast.mockReset();
});

describe("the cost sheet", () => {
  it("lists each material with grams, price a kg and cost a metre, and the totals", () => {
    renderSheet();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getByRole("link", { name: "Spandex 840D" })).toHaveAttribute("href", "/materials/rub");
    expect(within(rows[1]).getByText("0.5")).toBeInTheDocument();
    expect(within(rows[1]).getByText("₹900.00")).toBeInTheDocument();
    expect(within(rows[1]).getByText("₹0.45")).toBeInTheDocument();
    expect(within(table).getByText("₹0.782")).toBeInTheDocument();
    expect(within(table).getByText("₹2.282")).toBeInTheDocument();
  });

  it("marks a price that moved and offers to recalculate an out-of-date total", async () => {
    renderSheet();
    expect(screen.getByText("was ₹200.00")).toBeInTheDocument();
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/carries ₹2.222 a metre/);
    expect(banner).toHaveTextContent(/make it ₹2.282/);
    await userEvent.click(within(banner).getByRole("button", { name: /recalculate/i }));
    expect(recalc).toHaveBeenCalledWith("e1", expect.anything());
  });

  it("says nothing is out of date when it is not", () => {
    sheet = { ...base(), stale: false };
    renderSheet();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("names a material that no longer exists", () => {
    sheet = { ...base(), missing: 1 };
    renderSheet();
    expect(screen.getByRole("alert")).toHaveTextContent(/no longer exist/);
  });
});

describe("editing prices", () => {
  it("previews the new total, sends only the prices that changed, and asks to recalculate the elastics that share one", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: /edit prices/i }));

    const warp = screen.getByLabelText("Price of Poly 150D, ₹ a kg");
    expect(warp).toHaveValue(260);
    expect(screen.getByText(/also in 3 other elastics/)).toBeInTheDocument();

    await userEvent.clear(warp);
    await userEvent.type(warp, "300"); // +40 × 1.0 g = +0.04
    expect(screen.getByText("₹2.322")).toBeInTheDocument();

    const conv = screen.getByLabelText("Conversion cost (₹ a metre)");
    await userEvent.clear(conv);
    await userEvent.type(conv, "2");
    await userEvent.type(screen.getByLabelText("Reason for the price change"), "Supplier revision");

    const others = screen.getByRole("checkbox");
    expect(others).toBeChecked();
    expect(screen.getByText(/other elastics that use Poly 150D/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save and recalculate/i }));
    expect(save).toHaveBeenCalledWith(
      {
        id: "e1",
        body: {
          prices: [{ material: "warp", price: 300 }],
          conversionCost: 2,
          reason: "Supplier revision",
          recostOthers: true,
        },
      },
      expect.anything()
    );
  });

  it("does not offer to recalculate others when no shared price changed", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: /edit prices/i }));
    const rubber = screen.getByLabelText("Price of Spandex 840D, ₹ a kg");
    await userEvent.clear(rubber);
    await userEvent.type(rubber, "950");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save and recalculate/i }));
    expect(save.mock.calls[0][0].body).toMatchObject({ prices: [{ material: "rub", price: 950 }], recostOthers: false });
  });

  it("refuses an empty price, and shows the server's words when it refuses", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: /edit prices/i }));
    await userEvent.clear(screen.getByLabelText("Price of Poly 300D, ₹ a kg"));
    await userEvent.click(screen.getByRole("button", { name: /save and recalculate/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Enter a price for Poly 300D/);
    expect(save).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Price of Poly 300D, ₹ a kg"), "180");
    save.mockImplementation((_v, opts) => opts.onError(new ApiError("You do not have access to this", 403)));
    await userEvent.click(screen.getByRole("button", { name: /save and recalculate/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/do not have access/);
  });

  it("says what the total moved to, and how many others were recalculated", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("button", { name: /edit prices/i }));
    save.mockImplementation((_v, opts) => opts.onSuccess({
      changed: [], costing: { materialCost: 0.822, conversionCost: 2, totalCost: 2.822 },
      others: { recosted: 3, failed: [] }, sheet: base(),
    }));
    await userEvent.click(screen.getByRole("button", { name: /save and recalculate/i }));
    expect(toast).toHaveBeenCalledWith("Cost saved: ₹2.222 → ₹2.822 a metre. 3 other elastics recalculated.", "success");
  });
});
