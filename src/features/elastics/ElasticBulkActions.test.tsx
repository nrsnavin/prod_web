import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ElasticBulkActions, elasticsCsv } from "./ElasticBulkActions";
import { Elastic } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE ELASTIC LIST'S MULTI-SELECT
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const archiveMutate = vi.fn();
const costingMutate = vi.fn();
const minStockMutate = vi.fn();
let user: { role: string; department: string; features?: string[] } = { role: "admin", department: "admin" };

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));
vi.mock("./hooks", () => ({
  useElasticMutations: () => ({
    bulkArchive: { mutate: archiveMutate, isPending: false },
    bulkCosting: { mutate: costingMutate, isPending: false },
    bulkMinStock: { mutate: minStockMutate, isPending: false },
  }),
}));

const e = (id: string, name: string, over: Partial<Elastic> = {}) =>
  ({ _id: id, name, weaveType: "8", noOfHook: 8, pick: 12, weight: 2.4, stock: 100, ...over }) as Elastic;
const selected = [e("a", "20mm Knitted"), e("b", "25mm Woven", { archived: true })];

function Landed() {
  const loc = useLocation();
  return <pre data-testid="landed">{JSON.stringify({ path: loc.pathname, state: loc.state })}</pre>;
}

const setup = (rows = selected) =>
  render(
    <MemoryRouter initialEntries={["/elastics"]}>
      <Routes>
        <Route path="/elastics" element={<ElasticBulkActions selected={rows} onClear={() => {}} />} />
        <Route path="*" element={<Landed />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  [toast, archiveMutate, costingMutate, minStockMutate].forEach((f) => f.mockClear());
  user = { role: "admin", department: "admin" };
});

describe("starting something new with the selection", () => {
  it.each([
    ["New order", "/orders"],
    ["New group", "/elastic-groups"],
    ["New DC", "/delivery-challans"],
  ])("%s opens %s carrying the elastics", async (button, path) => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: new RegExp(button) }));
    expect(JSON.parse(screen.getByTestId("landed").textContent!)).toEqual({
      path,
      state: { prefillElastics: [{ _id: "a", name: "20mm Knitted" }, { _id: "b", name: "25mm Woven" }] },
    });
  });
});

describe("changing them", () => {
  it("updates the price by setting a conversion cost", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /Update price/ }));
    await u.type(screen.getByLabelText(/Conversion cost/), "3.5");
    await u.click(screen.getByRole("button", { name: "Apply to 2" }));
    expect(costingMutate.mock.calls[0][0]).toEqual({ ids: ["a", "b"], change: { conversionCost: 3.5 } });
  });

  it("or by a percentage", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /Update price/ }));
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
    await u.click(screen.getByRole("button", { name: /^Inactivate$/ }));
    // The dialog's confirm (the last one), not the toolbar button that opened it.
    await u.click(screen.getAllByRole("button", { name: "Inactivate" }).slice(-1)[0]);
    expect(archiveMutate.mock.calls[0][0]).toEqual({ ids: ["a"], archived: true });
    expect(screen.getByText(/300 m reserved against approved orders/)).toBeInTheDocument();
  });

  it("offers Reactivate for the inactive ones", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /Reactivate/ }));
    await u.click(screen.getAllByRole("button", { name: "Reactivate" }).slice(-1)[0]);
    expect(archiveMutate.mock.calls[0][0]).toEqual({ ids: ["b"], archived: false });
  });

  it("sets one min stock on all of them", async () => {
    const u = userEvent.setup();
    setup();
    await u.click(screen.getByRole("button", { name: /Min stock/ }));
    await u.type(screen.getByLabelText(/Min stock \(m\)/), "500");
    await u.click(screen.getByRole("button", { name: "Set for 2" }));
    expect(minStockMutate.mock.calls[0][0]).toEqual({ ids: ["a", "b"], minStock: 500 });
  });
});

describe("who sees what", () => {
  it("production sees no price, stock or inactivate actions", () => {
    user = { role: "production", department: "production" };
    setup();
    expect(screen.queryByRole("button", { name: /Update price/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Inactivate/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
  });

  it("only offers New order to someone who can open orders", () => {
    user = { role: "accounts", department: "finance", features: ["/elastics"] };
    setup();
    expect(screen.queryByRole("button", { name: /New order/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update price/ })).toBeInTheDocument();
  });
});

it("exports what is on the list for each", () => {
  const csv = elasticsCsv(selected);
  expect(csv.split("\r\n")[0]).toBe("Name,Weave type,Hooks,Pick,Weight (g/m),Stock (m),Reserved (m),Min stock (m),Status");
  expect(csv.split("\r\n")[2]).toBe("25mm Woven,8,8,12,2.4,100,0,0,Inactive");
});
