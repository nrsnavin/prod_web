import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MaterialBulkActions, bySupplier, materialsCsv, reorderQty } from "./MaterialBulkActions";
import { RawMaterial } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE RAW MATERIAL LIST'S MULTI-SELECT
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const updateMutate = vi.fn();
const archiveMutate = vi.fn();
let user: { role: string; department: string; features?: string[] } = { role: "admin", department: "admin" };

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));
vi.mock("./hooks", () => ({
  useMaterialMutations: () => ({
    bulkUpdate: { mutate: updateMutate, isPending: false },
    bulkArchive: { mutate: archiveMutate, isPending: false },
  }),
}));
vi.mock("../materialGroups/hooks", () => ({
  useMaterialGroups: () => ({ data: [{ _id: "g1", name: "Polyester" }] }),
}));
vi.mock("./StockOps", () => ({ BulkPriceUpdateModal: () => <div>price modal</div> }));

const m = (id: string, name: string, over: Partial<RawMaterial> = {}) =>
  ({ _id: id, name, category: "warp", stock: 10, minStock: 50, price: 200, supplier: { _id: "s1", name: "Ravi Yarns" }, ...over }) as RawMaterial;

function Landed() {
  const loc = useLocation();
  return <pre data-testid="landed">{JSON.stringify({ path: loc.pathname, state: loc.state })}</pre>;
}
const setup = (rows: RawMaterial[]) =>
  render(
    <MemoryRouter initialEntries={["/materials"]}>
      <Routes>
        <Route path="/materials" element={<MaterialBulkActions selected={rows} onClear={() => {}} />} />
        <Route path="*" element={<Landed />} />
      </Routes>
    </MemoryRouter>
  );
const landed = () => JSON.parse(screen.getByTestId("landed").textContent!);
async function choose(u: ReturnType<typeof userEvent.setup>, item: RegExp | string) {
  await u.click(screen.getByRole("button", { name: /^\s*Change/ }));
  await u.click(screen.getByRole("menuitem", { name: item }));
}

beforeEach(() => {
  [toast, updateMutate, archiveMutate].forEach((f) => f.mockReset());
  user = { role: "admin", department: "admin" };
});

describe("raising a purchase order", () => {
  it("goes straight to the PO form when they share a supplier, topped up to twice the minimum", async () => {
    const u = userEvent.setup();
    setup([m("a", "Poly 150D"), m("b", "Poly 300D", { stock: 120, minStock: 50 })]);
    await u.click(screen.getByRole("button", { name: /Raise PO/ }));
    expect(landed()).toEqual({
      path: "/purchase-orders/new",
      state: {
        prefill: {
          supplier: "s1",
          supplierName: "Ravi Yarns",
          items: [{ rawMaterial: "a", quantity: 90, price: 200 }, { rawMaterial: "b", quantity: 0, price: 200 }],
        },
      },
    });
  });

  it("asks which supplier first when they come from several", async () => {
    const u = userEvent.setup();
    setup([m("a", "Poly 150D"), m("b", "Spandex", { supplier: { _id: "s2", name: "Lycra Co" } }), m("c", "Loose", { supplier: null })]);
    await u.click(screen.getByRole("button", { name: /Raise PO…/ }));
    expect(screen.getByText("No supplier set")).toBeInTheDocument();
    await u.click(screen.getAllByRole("button", { name: "PO for 1" })[1]);
    expect(landed().state.prefill).toMatchObject({ supplier: "s2", supplierName: "Lycra Co", items: [{ rawMaterial: "b" }] });
  });

  it("is not offered while an archived one is ticked", () => {
    setup([m("a", "Poly 150D"), m("b", "Old", { archived: true })]);
    expect(screen.getByRole("button", { name: /Raise PO/ })).toBeDisabled();
  });

  it("is not shown to someone who cannot open purchase orders", () => {
    user = { role: "production", department: "production" };
    setup([m("a", "Poly 150D")]);
    expect(screen.queryByRole("button", { name: /Raise PO/ })).not.toBeInTheDocument();
  });
});

describe("changing them", () => {
  it("sets one min stock on all of them", async () => {
    const u = userEvent.setup();
    setup([m("a", "Poly 150D"), m("b", "Poly 300D")]);
    await choose(u, /Min stock/);
    await u.type(screen.getByLabelText("Min stock"), "75");
    await u.click(screen.getByRole("button", { name: "Set for 2" }));
    expect(updateMutate.mock.calls[0][0]).toEqual({ ids: ["a", "b"], change: { minStock: 75 } });
  });

  it("files them under a group, or under none", async () => {
    const u = userEvent.setup();
    setup([m("a", "Poly 150D")]);
    await choose(u, /Group/);
    await u.selectOptions(screen.getByLabelText("Group"), "__none__");
    await u.click(screen.getByRole("button", { name: "Set for 1" }));
    expect(updateMutate.mock.calls[0][0]).toEqual({ ids: ["a"], change: { group: null } });
  });

  it("archives the active ones and lists any refused", async () => {
    archiveMutate.mockImplementationOnce((_v, opts) => opts.onSuccess({
      done: 0, refused: 1, results: [{ id: "a", name: "Poly 150D", ok: false, reason: "2 open orders still need it" }],
    }));
    const u = userEvent.setup();
    setup([m("a", "Poly 150D"), m("b", "Old", { archived: true })]);
    await choose(u, "Archive (1)");
    await u.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveMutate.mock.calls[0][0]).toEqual({ ids: ["a"], archived: true });
    expect(screen.getByText(/2 open orders still need it/)).toBeInTheDocument();
  });

  it("opens the price update for just the ticked ones", async () => {
    const u = userEvent.setup();
    setup([m("a", "Poly 150D")]);
    await choose(u, /Prices/);
    expect(screen.getByText("price modal")).toBeInTheDocument();
  });
});

it("groups by supplier, and exports a row each", () => {
  const rows = [m("a", "Poly 150D"), m("b", "Spandex", { supplier: null })];
  expect(bySupplier(rows).map((g) => [g.supplierName, g.items.length])).toEqual([["Ravi Yarns", 1], ["No supplier set", 1]]);
  expect(reorderQty(m("x", "x", { stock: 10, minStock: 50 }))).toBe(90);
  expect(materialsCsv(rows).split("\r\n")[1]).toBe("Poly 150D,warp,,Ravi Yarns,,10,50,200,Active");
});
