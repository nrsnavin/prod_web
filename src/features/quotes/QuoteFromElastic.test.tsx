import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { QuoteCreatePage } from "./QuoteCreatePage";
import { elasticSpec, productFromElastic } from "./fromElastic";
import { Elastic } from "@/features/elastics/types";

// ══════════════════════════════════════════════════════════════════
//  "NEW QUOTATION" FROM THE ELASTIC LIST'S SELECTION
//
//  Each elastic becomes a product costed from its own recipe: weights
//  from the elastic, rates from the materials' prices, conversion cost
//  from its cost sheet — the same sum as the elastic's costing.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const createMutate = vi.fn();
const getById = vi.fn();

vi.mock("./hooks", () => ({
  useQuoteMutations: () => ({ create: { mutate: createMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/features/customers/api", () => ({
  customerService: { list: vi.fn().mockResolvedValue({ customers: [], total: 0, page: 1, pages: 1 }) },
}));
vi.mock("@/features/elastics/api", () => ({
  elasticService: { getById: (id: string) => getById(id) },
}));

const mat = (name: string, price: number) => ({ _id: name, name, price });
const knitted = {
  _id: "e1",
  name: "20mm Knitted",
  weaveType: "8",
  weight: 2.4,
  noOfHook: 8,
  pick: 12,
  testingParameters: { width: 20 },
  warpYarn: [{ id: mat("Poly 150D", 210), weight: 1.2 }, { id: mat("Nylon 70D", 400), weight: 0.3 }],
  warpSpandex: { id: mat("Spandex 840D", 900), weight: 0.5 },
  spandexCovering: { id: mat("Cover 40D", 300), weight: 0.2 },
  weftYarn: { id: mat("Poly 300D", 180), weight: 0.4 },
  costing: { conversionCost: 1.75, totalCost: 3.4 },
} as unknown as Elastic;

beforeEach(() => {
  [toast, createMutate, getById].forEach((f) => f.mockReset());
});

describe("an elastic as a quotation product", () => {
  it("takes its recipe as the costing sheet, extra warp yarns after the four", () => {
    const p = productFromElastic(knitted);
    expect(p).toMatchObject({ productName: "20mm Knitted", elastic: "e1", conversionCost: "1.75" });
    expect(p.materials.map((m) => [m.label, m.weightGrams, m.ratePerKg])).toEqual([
      ["Warp yarn", "1.2", "210"],
      ["Spandex covering", "0.2", "300"],
      ["Warp spandex", "0.5", "900"],
      ["Weft yarn", "0.4", "180"],
      ["Warp yarn — Nylon 70D", "0.3", "400"],
    ]);
  });

  it("leaves a row blank when the elastic has no such material", () => {
    const p = productFromElastic({ _id: "e2", name: "Plain" } as Elastic);
    expect(p.materials).toHaveLength(4);
    expect(p.materials.every((m) => m.weightGrams === "" && m.ratePerKg === "")).toBe(true);
    expect(p.conversionCost).toBe("1.25"); // the sheet's own default
  });

  it("writes a short spec line", () => {
    expect(elasticSpec(knitted)).toBe("Weave 8 · 20 mm · 2.4 g/m · 8 hooks · pick 12");
  });
});

describe("the quotation page, sent elastics", () => {
  const renderWith = (state: unknown) =>
    render(
      <RouterProvider
        router={createMemoryRouter(
          [{ path: "/quotes/new", element: <QuoteCreatePage /> }, { path: "/quotes/:id", element: <div>Saved</div> }],
          { initialEntries: [{ pathname: "/quotes/new", state }] }
        )}
      />
    );

  it("opens with one product per elastic, and saves each line against its elastic", async () => {
    getById.mockImplementation(async (id: string) =>
      id === "e1" ? knitted : { _id: "e3", name: "25mm Woven", weftYarn: { id: mat("Poly 300D", 180), weight: 0.6 } });
    const u = userEvent.setup();
    renderWith({ prefillElastics: [{ _id: "e1", name: "20mm Knitted" }, { _id: "e3", name: "25mm Woven" }] });

    await waitFor(() => expect(screen.getAllByLabelText(/^product \*/i)).toHaveLength(2));
    expect(screen.getAllByLabelText(/^product \*/i).map((i) => (i as HTMLInputElement).value))
      .toEqual(["20mm Knitted", "25mm Woven"]);

    await u.click(screen.getByRole("button", { name: /enter a new customer/i }));
    await u.type(screen.getByLabelText(/^customer \*/i), "Ravi Textiles");
    await u.click(screen.getByRole("button", { name: "Raise quotation" }));

    const body = createMutate.mock.calls[0][0];
    expect(body.lines.map((l: { elastic: string }) => l.elastic)).toEqual(["e1", "e3"]);
    expect(body.lines[0].conversionCost).toBe(1.75);
    expect(body.lines[1].materials).toEqual([{ label: "Weft yarn", weightGrams: 0.6, ratePerKg: 180 }]);
  });

  it("keeps the ones it could load and says how many it could not", async () => {
    getById.mockImplementation(async (id: string) => {
      if (id === "e1") return knitted;
      throw new Error("gone");
    });
    renderWith({ prefillElastics: [{ _id: "e1", name: "20mm Knitted" }, { _id: "zz", name: "Gone" }] });
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^1 of the elastics could not be loaded/), "error"));
    expect(screen.getAllByLabelText(/^product \*/i).map((i) => (i as HTMLInputElement).value)).toEqual(["20mm Knitted"]);
  });

  it("starts blank when sent nothing", () => {
    renderWith(null);
    expect(getById).not.toHaveBeenCalled();
    expect((screen.getAllByLabelText(/^product \*/i)[0] as HTMLInputElement).value).toBe("");
  });
});
