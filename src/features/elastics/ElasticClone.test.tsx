import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cloneInitial, cloneExtras, cloneBody } from "./elasticClone";
import { ElasticDetailPage } from "./ElasticDetailPage";
import type { Elastic, ElasticFormValues } from "./types";

// Cloning is how most new products get made here: same yarns, same
// warping build, a different width. The two ways it can go wrong are
// opposite, so both are asserted — it carries too little (a beam
// template silently lost, and someone re-enters it by hand), or it
// carries too much (stock the ledger cannot account for).

const source: Elastic = {
  _id: "e1",
  name: "Woven Elastic 25mm",
  archived: false,
  weaveType: "Plain",
  warpSpandex: { id: { _id: "m1", name: "Spandex 420D" }, weight: 3.2 },
  spandexCovering: { id: { _id: "m2", name: "Nylon 70D" }, weight: 1.1 },
  weftYarn: { id: { _id: "m3", name: "Polyester 150D" }, weight: 2.4 },
  warpYarn: [
    { id: { _id: "m4", name: "Warp 75D" }, weight: 4.5 },
    { id: { _id: "m5", name: "Warp 100D" }, weight: 1.5 },
  ],
  spandexEnds: 48,
  yarnEnds: 120,
  pick: 14,
  noOfHook: 26,
  weight: 12.7,
  conversionCost: 3.5,
  // Position, not specification — none of this may travel.
  stock: 4200,
  quantityProduced: 91_000,
  reservedStock: 500,
  minStock: 250,
  costing: { totalCost: 41.2, conversionCost: 3.5 },
  testingParameters: { width: 25, elongation: 130, recovery: 92, strech: "medium" },
  warpingPlanTemplate: {
    noOfBeams: 2,
    beams: [
      { beamNo: 1, sections: [{ warpYarn: { _id: "m4", name: "Warp 75D" }, ends: 60, maxMeters: 5000 }] },
      { beamNo: 2, sections: [{ warpYarn: { _id: "m5", name: "Warp 100D" }, ends: 60, maxMeters: 5000 }] },
    ],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("what a clone carries", () => {
  it("copies the whole specification", () => {
    const c = cloneInitial(source);
    expect(c).toMatchObject({
      weaveType: "Plain",
      warpSpandex: source.warpSpandex,
      spandexCovering: source.spandexCovering,
      weftYarn: source.weftYarn,
      warpYarn: source.warpYarn,
      spandexEnds: 48,
      yarnEnds: 120,
      pick: 14,
      noOfHook: 26,
      weight: 12.7,
      conversionCost: 3.5,
    });
  });

  // Re-entering a two-beam template by hand is exactly the work this
  // feature exists to remove.
  it("copies the warping template", () => {
    expect(cloneInitial(source).warpingPlanTemplate).toEqual(source.warpingPlanTemplate);
  });

  it("leaves the name empty", () => {
    expect(cloneInitial(source).name).toBe("");
  });

  // Stock carried into a clone is stock no ledger accounts for — the one
  // thing a stock system must never invent.
  it("carries nothing about the stock position", () => {
    const c = cloneInitial(source);
    expect(c.stock).toBeUndefined();
    expect(c.quantityProduced).toBeUndefined();
    expect(c.reservedStock).toBeUndefined();
    expect(c.archived).toBeUndefined();
    expect(c._id).toBe("");
    expect(c.createdAt).toBeUndefined();
  });

  it("falls back to the costing's conversion cost when the field is unset", () => {
    const { conversionCost, ...withoutField } = source;
    void conversionCost;
    expect(cloneInitial(withoutField as Elastic).conversionCost).toBe(3.5);
  });

  // The web form cannot edit these, so without carrying them a clone
  // looks identical and tests differently.
  it("carries the testing parameters and the reorder level the form cannot edit", () => {
    expect(cloneExtras(source)).toEqual({
      testingParameters: { width: 25, elongation: 130, recovery: 92, strech: "medium" },
      minStock: 250,
    });
  });

  it("omits them entirely when the source has none", () => {
    expect(cloneExtras({ _id: "x", name: "Bare" })).toEqual({});
  });

  it("copies the testing parameters rather than sharing the object", () => {
    const extras = cloneExtras(source);
    extras.testingParameters!.width = 40;
    expect(source.testingParameters!.width).toBe(25);
  });

  it("builds the create payload from what was typed plus what was carried", () => {
    const typed = { name: "Woven Elastic 32mm", pick: 16 } as unknown as ElasticFormValues;
    expect(cloneBody(typed, source)).toMatchObject({
      name: "Woven Elastic 32mm",
      pick: 16,
      minStock: 250,
      testingParameters: { width: 25 },
    });
  });
});

// ── The button ───────────────────────────────────────────────────
const { create, update, navigate } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("./hooks", () => ({
  useElastic: () => ({ data: source, isLoading: false, isError: false, error: null }),
  useElasticMutations: () => ({
    create: { mutate: create, isPending: false },
    update: { mutate: update, isPending: false },
    recalculate: { mutate: vi.fn(), isPending: false },
    setArchived: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
    saveTemplate: { mutate: vi.fn(), isPending: false },
  }),
  useMaterialsByCategory: () => ({
    data: {
      warp: [{ _id: "m4", name: "Warp 75D" }, { _id: "m5", name: "Warp 100D" }],
      weft: [{ _id: "m3", name: "Polyester 150D" }],
      rubber: [{ _id: "m1", name: "Spandex 420D" }],
      covering: [{ _id: "m2", name: "Nylon 70D" }],
    },
  }),
  useElasticOrders: () => ({ data: undefined, isLoading: false }),
  useElasticJobs: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

function renderPage() {
  // The page's sibling panels (stock card, history) reach for the query
  // client directly, so the provider is needed even though every hook
  // this test cares about is mocked.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/elastics/e1"]}>
        <Routes>
          <Route path="/elastics/:id" element={<ElasticDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  create.mockClear();
  update.mockClear();
  navigate.mockClear();
});

describe("cloning from the detail page", () => {
  it("opens a form named after the source, with an empty name and the spec filled", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /clone/i }));

    expect(await screen.findByText("Clone of Woven Elastic 25mm")).toBeInTheDocument();
    expect(screen.getByLabelText(/elastic name/i)).toHaveValue("");
    // …and everything else came across.
    expect(screen.getByLabelText(/weave type/i)).toHaveValue("Plain");
    expect(screen.getByLabelText(/^pick$/i)).toHaveValue(14);
    expect(screen.getByLabelText(/hooks|no of hook/i)).toHaveValue(26);
  });

  it("creates a new elastic rather than updating the one being cloned", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /clone/i }));

    await user.type(screen.getByLabelText(/elastic name/i), "Woven Elastic 32mm");
    await user.click(screen.getByRole("button", { name: /save|create/i }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0]).toMatchObject({
      name: "Woven Elastic 32mm",
      pick: 14,
      noOfHook: 26,
      minStock: 250,
      testingParameters: { width: 25 },
    });
  });

  it("will not submit until the clone is named", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /clone/i }));
    await user.click(screen.getByRole("button", { name: /save|create/i }));

    await waitFor(() => expect(screen.getByText(/name is required/i)).toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });
});
