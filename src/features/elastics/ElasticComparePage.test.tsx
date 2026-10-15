import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ElasticComparePage, compareIds } from "./ElasticComparePage";

// ══════════════════════════════════════════════════════════════════
//  ELASTICS SIDE BY SIDE
// ══════════════════════════════════════════════════════════════════

const getById = vi.fn();
vi.mock("./api", () => ({ elasticService: { getById: (id: string) => getById(id) } }));

const mat = (name: string) => ({ _id: name, name, price: 100 });
const elastics: Record<string, unknown> = {
  a: {
    _id: "a", name: "20mm Knitted", weaveType: "8", weight: 2.4, pick: 12, noOfHook: 8,
    warpYarn: [{ id: mat("Poly 150D"), weight: 1.2 }], weftYarn: { id: mat("Poly 300D"), weight: 0.4 },
    costing: { materialCost: 2.1, conversionCost: 1.25, totalCost: 3.35 },
    testingParameters: { width: 20, elongation: 120 }, stock: 500, reservedStock: 200, minStock: 400,
  },
  b: {
    _id: "b", name: "25mm Woven", weaveType: "8", weight: 3.1, pick: 12, noOfHook: 10,
    warpYarn: [{ id: mat("Poly 150D"), weight: 1.6 }], weftYarn: { id: mat("Poly 300D"), weight: 0.4 },
    costing: { materialCost: 2.8, conversionCost: 1.25, totalCost: 4.05 },
    testingParameters: { width: 25, elongation: 120 }, stock: 0,
  },
};

const renderAt = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/elastics/compare" element={<ElasticComparePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

const row = (label: string) => screen.getByRole("rowheader", { name: new RegExp(`^(differs)?${label}$`) }).closest("tr")!;
const cells = (label: string) => within(row(label)).getAllByRole("cell").map((c) => c.textContent);

beforeEach(() => {
  getById.mockReset();
  getById.mockImplementation(async (id: string) => elastics[id]);
});

it("reads the ids from the URL, once each, at most five", () => {
  expect(compareIds("a,b,a, c")).toEqual(["a", "b", "c"]);
  expect(compareIds("1,2,3,4,5,6,7")).toHaveLength(5);
  expect(compareIds(null)).toEqual([]);
});

describe("the comparison", () => {
  it("puts each property side by side", async () => {
    renderAt("/elastics/compare?ids=a,b");
    expect(await screen.findByRole("link", { name: "20mm Knitted" })).toHaveAttribute("href", "/elastics/a");
    expect(cells("Hooks")).toEqual(["8", "10"]);
    expect(cells("Warp yarns")).toEqual(["Poly 150D · 1.2 g/m", "Poly 150D · 1.6 g/m"]);
    expect(cells("Total")).toEqual(["₹3.35", "₹4.05"]);
    expect(cells("Free")).toEqual(["300", "0"]);
  });

  it("marks what differs and can hide what is the same", async () => {
    const u = userEvent.setup();
    renderAt("/elastics/compare?ids=a,b");
    await screen.findByRole("link", { name: "20mm Knitted" });
    expect(row("Hooks")).toHaveAttribute("data-differs");
    expect(row("Pick")).not.toHaveAttribute("data-differs");
    await u.click(screen.getByLabelText("Only differences"));
    expect(screen.queryByRole("rowheader", { name: /^Pick$/ })).not.toBeInTheDocument();
    expect(row("Hooks")).toBeInTheDocument();
  });

  it("asks for at least two", () => {
    renderAt("/elastics/compare?ids=a");
    expect(screen.getByText(/Tick 2 to 5 elastics/)).toBeInTheDocument();
    expect(getById).not.toHaveBeenCalled();
  });
});
