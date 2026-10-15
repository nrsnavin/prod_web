import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ElasticListPage } from "./ElasticListPage";

// ══════════════════════════════════════════════════════════════════
//  THE ELASTIC LIST: LOW STOCK, AND A GROUP AS A SAVED SELECTION
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const useElastics = vi.fn();
const list = vi.fn();

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin", department: "admin" } }) }));
vi.mock("./hooks", () => ({
  useElastics: (p: unknown) => useElastics(p),
  useElasticMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    bulkArchive: { mutate: vi.fn(), isPending: false },
    bulkCosting: { mutate: vi.fn(), isPending: false },
    bulkMinStock: { mutate: vi.fn(), isPending: false },
    bulkCopyTemplate: { mutate: vi.fn(), isPending: false },
    bulkTesting: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("./api", () => ({ elasticService: { list: (p: unknown) => list(p) } }));
vi.mock("@/features/elasticGroups/hooks", () => ({
  useElasticGroups: () => ({
    isLoading: false,
    data: [{ _id: "g1", name: "Acme usual", customer: { name: "Acme" }, items: [{ elastic: { _id: "x", name: "X" } }, { elastic: "y" }] }],
  }),
}));

const row = { _id: "a", name: "20mm Knitted", stock: 500, reservedStock: 200, minStock: 400 };

beforeEach(() => {
  [toast, useElastics, list].forEach((f) => f.mockReset());
  useElastics.mockReturnValue({ data: { elastics: [row], total: 1, page: 1 }, isLoading: false, isError: false });
});

const renderPage = () => render(<MemoryRouter><ElasticListPage /></MemoryRouter>);

it("flags LOW on free stock, and shows how much is free", () => {
  renderPage();
  // 500 on the shelf, 200 promised: 300 free is under the 400 minimum.
  const cell = screen.getByText("300 free").closest("td")!;
  expect(within(cell).getByText("LOW")).toBeInTheDocument();
});

it("asks for low stock only", async () => {
  const u = userEvent.setup();
  renderPage();
  await u.click(screen.getByLabelText("Low stock only"));
  expect(useElastics).toHaveBeenLastCalledWith(expect.objectContaining({ lowStock: true, page: 1 }));
});

it("ticks a group's elastics, ready for New order", async () => {
  list.mockResolvedValue({
    elastics: [{ _id: "x", name: "X" }, { _id: "y", name: "Y", archived: true }], total: 2, page: 1,
  });
  const u = userEvent.setup();
  renderPage();
  await u.selectOptions(screen.getByLabelText("Select from a group"), "g1");
  expect(list).toHaveBeenCalledWith({ ids: "x,y", includeArchived: "true", limit: 200 });
  await waitFor(() => expect(screen.getByText("2 selected")).toBeInTheDocument());
  expect(toast).toHaveBeenCalledWith('Selected 2 from "Acme usual"', "success");
});
