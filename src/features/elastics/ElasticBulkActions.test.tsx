import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ElasticBulkActions, elasticsCsv, restockShortfall } from "./ElasticBulkActions";
import { Elastic } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE ELASTIC LIST'S MULTI-SELECT
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const archiveMutate = vi.fn();
const costingMutate = vi.fn();
const minStockMutate = vi.fn();
const copyTemplateMutate = vi.fn();
const testingMutate = vi.fn();
const addElastics = vi.fn();
const restock = vi.fn();
let user: { role: string; department: string; features?: string[] } = { role: "admin", department: "admin" };

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));
vi.mock("./hooks", () => ({
  useElasticMutations: () => ({
    bulkArchive: { mutate: archiveMutate, isPending: false },
    bulkCosting: { mutate: costingMutate, isPending: false },
    bulkMinStock: { mutate: minStockMutate, isPending: false },
    bulkCopyTemplate: { mutate: copyTemplateMutate, isPending: false },
    bulkTesting: { mutate: testingMutate, isPending: false },
  }),
}));
vi.mock("@/features/elasticGroups/hooks", () => ({
  useElasticGroups: () => ({
    isLoading: false,
    data: [{ _id: "g1", name: "Usual", customer: { name: "Acme" }, items: [{}, {}] }],
  }),
}));
vi.mock("@/features/elasticGroups/api", () => ({
  elasticGroupService: { addElastics: (...a: unknown[]) => addElastics(...a) },
}));
vi.mock("@/features/orders/api", () => ({
  orderService: { restock: (...a: unknown[]) => restock(...a) },
}));

const e = (id: string, name: string, over: Partial<Elastic> = {}) =>
  ({ _id: id, name, weaveType: "8", noOfHook: 8, pick: 12, weight: 2.4, stock: 100, ...over }) as Elastic;
const selected = [e("a", "20mm Knitted"), e("b", "25mm Woven", { archived: true })];

function Landed() {
  const loc = useLocation();
  return <pre data-testid="landed">{JSON.stringify({ path: loc.pathname, search: loc.search, state: loc.state })}</pre>;
}
const landed = () => JSON.parse(screen.getByTestId("landed").textContent!);

const setup = (rows = selected) =>
  render(
    <MemoryRouter initialEntries={["/elastics"]}>
      <Routes>
        <Route path="/elastics" element={<ElasticBulkActions selected={rows} onClear={() => {}} />} />
        <Route path="*" element={<Landed />} />
      </Routes>
    </MemoryRouter>
  );

/** Open a toolbar menu and choose an item in it. */
async function choose(u: ReturnType<typeof userEvent.setup>, menu: string, item: RegExp | string) {
  await u.click(screen.getByRole("button", { name: new RegExp(`^\\s*${menu}`) }));
  await u.click(screen.getByRole("menuitem", { name: item }));
}

beforeEach(() => {
  [toast, archiveMutate, costingMutate, minStockMutate, copyTemplateMutate, testingMutate, addElastics, restock]
    .forEach((f) => f.mockReset());
  user = { role: "admin", department: "admin" };
});

describe("starting something new with the selection", () => {
  it.each([
    ["New order", "/orders"],
    ["New quotation", "/quotes/new"],
    ["New group", "/elastic-groups"],
    ["New DC", "/delivery-challans"],
  ])("%s opens %s carrying the elastics", async (item, path) => {
    const u = userEvent.setup();
    setup();
    await choose(u, "Create", new RegExp(`^${item}`));
    expect(landed()).toMatchObject({
      path,
      state: { prefillElastics: [{ _id: "a", name: "20mm Knitted" }, { _id: "b", name: "25mm Woven" }] },
    });
  });

  it("adds them to an existing group", async () => {
    addElastics.mockResolvedValue({ added: 1, alreadyThere: 1, group: { name: "Usual" } });
    const u = userEvent.setup();
    setup();
    await choose(u, "Create", /Add to a group/);
    await u.selectOptions(screen.getByLabelText("Group"), "g1");
    await u.click(screen.getByRole("button", { name: "Add to group" }));
    expect(addElastics).toHaveBeenCalledWith("g1", ["a", "b"]);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Added 1 to "Usual" — 1 already in it', "success"));
  });

  it("raises a restock order suggesting what brings free stock back to the reorder level", async () => {
    restock.mockResolvedValue({ orderId: "o9", orderNo: 9 });
    const low = [
      e("a", "20mm Knitted", { stock: 300, reservedStock: 200, minStock: 500 }),
      e("b", "25mm Woven", { stock: 900, minStock: 500 }),
    ];
    const u = userEvent.setup();
    setup(low);
    await choose(u, "Create", /Restock/);
    expect(screen.getByLabelText("Metres to make of 20mm Knitted")).toHaveValue(400);
    // Above its reorder level: nothing suggested, so left out unless typed in.
    expect(screen.getByLabelText("Metres to make of 25mm Woven")).toHaveValue(null);
    await u.click(screen.getByRole("button", { name: "Raise restock order (1)" }));
    expect(restock).toHaveBeenCalledWith([{ elastic: "a", quantity: 400 }]);
    await waitFor(() => expect(landed().path).toBe("/orders/o9"));
  });

  it("compares 2 to 5 of them", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /Compare/ }));
    expect(landed()).toMatchObject({ path: "/elastics/compare", search: "?ids=a,b" });
  });

  it("cannot compare just one", () => {
    setup([selected[0]]);
    expect(screen.getByRole("button", { name: /Compare/ })).toBeDisabled();
  });
});

describe("changing them", () => {
  it("updates the price by setting a conversion cost", async () => {
    const u = userEvent.setup();
    setup();
    await choose(u, "Change", /Update price/);
    await u.type(screen.getByLabelText(/Conversion cost/), "3.5");
    await u.click(screen.getByRole("button", { name: "Apply to 2" }));
    expect(costingMutate.mock.calls[0][0]).toEqual({ ids: ["a", "b"], change: { conversionCost: 3.5 } });
  });

  it("or by a percentage", async () => {
    const u = userEvent.setup();
    setup();
    await choose(u, "Change", /Update price/);
    await u.click(screen.getByLabelText(/Change conversion cost by %/));
    await u.type(screen.getByLabelText(/Change \(%\)/), "-5");
    await u.click(screen.getByRole("button", { name: "Apply to 2" }));
    expect(costingMutate.mock.calls[0][0].change).toEqual({ changePercent: -5 });
  });

  it("inactivates only the active ones, and lists any refused", async () => {
    archiveMutate.mockImplementationOnce((_v, opts) => opts.onSuccess({
      done: 0, refused: 1, results: [{ id: "a", name: "20mm Knitted", ok: false, reason: "300 m reserved against approved orders" }],
    }));
    const u = userEvent.setup();
    setup();
    await choose(u, "Change", "Inactivate (1)");
    await u.click(screen.getByRole("button", { name: "Inactivate" }));
    expect(archiveMutate.mock.calls[0][0]).toEqual({ ids: ["a"], archived: true });
    expect(screen.getByText(/300 m reserved against approved orders/)).toBeInTheDocument();
  });

  it("offers Reactivate for the inactive ones", async () => {
    const u = userEvent.setup();
    setup();
    await choose(u, "Change", "Reactivate (1)");
    await u.click(screen.getByRole("button", { name: "Reactivate" }));
    expect(archiveMutate.mock.calls[0][0]).toEqual({ ids: ["b"], archived: false });
  });

  it("sets one min stock on all of them", async () => {
    const u = userEvent.setup();
    setup();
    await choose(u, "Change", /Min stock/);
    await u.type(screen.getByLabelText(/Min stock \(m\)/), "500");
    await u.click(screen.getByRole("button", { name: "Set for 2" }));
    expect(minStockMutate.mock.calls[0][0]).toEqual({ ids: ["a", "b"], minStock: 500 });
  });

  it("sets only the testing parameters filled in", async () => {
    const u = userEvent.setup();
    setup();
    await choose(u, "Change", /Testing parameters/);
    await u.type(screen.getByLabelText("Elongation (%)"), "120");
    await u.type(screen.getByLabelText("Width (mm)"), "20");
    await u.click(screen.getByRole("button", { name: "Set for 2" }));
    expect(testingMutate.mock.calls[0][0]).toEqual({ ids: ["a", "b"], params: { width: 20, elongation: 120 } });
  });

  it("copies a warping template from the one that has it to the others", async () => {
    const withPlan = [
      e("a", "20mm Knitted", { warpingPlanTemplate: { beams: [{}] } } as Partial<Elastic>),
      e("b", "25mm Woven"),
      e("c", "30mm Woven"),
    ];
    const u = userEvent.setup();
    setup(withPlan);
    await choose(u, "Change", /Copy warping template/);
    await u.click(screen.getByLabelText(/Replace templates/));
    await u.click(screen.getByRole("button", { name: "Copy to 2" }));
    expect(copyTemplateMutate.mock.calls[0][0]).toEqual({ sourceId: "a", ids: ["b", "c"], replace: true });
  });

  it("does not offer to copy a template when none of them has one", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /^\s*Change/ }));
    expect(screen.getByRole("menuitem", { name: /Copy warping template/ })).toBeDisabled();
    expect(screen.getByText("None of these has a template to copy")).toBeInTheDocument();
  });
});

describe("who sees what", () => {
  it("production sees no Change menu and no price list", async () => {
    user = { role: "production", department: "production" };
    const u = userEvent.setup();
    setup();
    expect(screen.queryByRole("button", { name: /^\s*Change/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /^\s*Print/ }));
    expect(screen.getByRole("menuitem", { name: /Spec sheets/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Price list/ })).not.toBeInTheDocument();
  });

  it("offers nothing to create to someone who can open none of orders, quotes, DCs or groups", () => {
    user = { role: "accounts", department: "finance", features: ["/elastics"] };
    setup();
    expect(screen.getByRole("button", { name: /^\s*Change/ })).toBeInTheDocument();
    // An empty menu is not shown at all.
    expect(screen.queryByRole("button", { name: /^\s*Create/ })).not.toBeInTheDocument();
  });
});

it("exports what is on the list for each", () => {
  const csv = elasticsCsv(selected);
  expect(csv.split("\r\n")[0]).toBe("Name,Weave type,Hooks,Pick,Weight (g/m),Stock (m),Reserved (m),Min stock (m),Status");
  expect(csv.split("\r\n")[2]).toBe("25mm Woven,8,8,12,2.4,100,0,0,Inactive");
});

it("works out the restock shortfall on free stock", () => {
  expect(restockShortfall(e("a", "x", { stock: 300, reservedStock: 200, minStock: 500 }))).toBe(400);
  expect(restockShortfall(e("a", "x", { stock: 900, minStock: 500 }))).toBe(0);
  expect(restockShortfall(e("a", "x", { stock: 10.5 }))).toBe(0);
});
