import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MrpPage } from "./MrpPage";

// The MRP sheet worked out again on request, and after an elastic's
// recipe is corrected from it.

const refetch = vi.fn();
const mrp = {
  jobId: "j1", jobOrderNo: 12, orderNo: 4, customerName: "Acme", dateLabel: "21 Oct 2026",
  status: "weaving", productionMode: "in_house" as const,
  elastics: [{ id: "e1", name: "25mm Woven", quantity: 5000 }, { id: null, name: "Unknown", quantity: 100 }],
  materials: [],
  computedAt: "2026-10-25T04:30:00Z",
};
vi.mock("./hooks", () => ({
  useMrp: () => ({ data: mrp, isLoading: false, isError: false, error: null, refetch, isFetching: false, dataUpdatedAt: Date.now() }),
}));
vi.mock("./ProductionModeControl", () => ({ ProductionModeControl: () => null }));
vi.mock("./MrpShortfallPo", () => ({ MrpShortfallPo: () => null }));
let savedName: string | null = null;
vi.mock("./MrpElasticEdit", () => ({
  MrpElasticEdit: ({ elasticId, onSaved }: { elasticId: string; onSaved: (n: string) => void }) => (
    <div role="dialog" aria-label="Edit elastic">
      editing {elasticId}
      <button onClick={() => onSaved(savedName ?? "25mm Woven")}>Save it</button>
    </div>
  ),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const renderPage = () => render(
  <MemoryRouter initialEntries={["/jobs/j1/mrp"]}>
    <Routes><Route path="/jobs/:id/mrp" element={<MrpPage />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => {
  refetch.mockReset();
  refetch.mockResolvedValue({ isError: false });
  toast.mockReset();
  savedName = null;
});

describe("updating the MRP sheet", () => {
  it("works the requirement out again on request", async () => {
    renderPage();
    expect(screen.getByText(/From the recipes as at/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /update mrp/i }));
    expect(refetch).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("MRP updated from the current recipes", "success");
  });

  it("says so when it could not", async () => {
    refetch.mockResolvedValue({ isError: true, error: new Error("Server down") });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /update mrp/i }));
    expect(toast).toHaveBeenCalledWith("Server down", "error");
  });

  it("opens an elastic to edit, and updates the sheet once it is saved", async () => {
    renderPage();
    // Only an elastic the sheet can name has an Edit button.
    expect(screen.getAllByRole("button", { name: /edit the recipe/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "25mm Woven" })).toHaveAttribute("href", "/elastics/e1");

    await userEvent.click(screen.getByRole("button", { name: /edit the recipe of 25mm Woven/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("editing e1");
    await userEvent.click(screen.getByRole("button", { name: "Save it" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
    expect(await screen.findByText(/From the recipes/)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("25mm Woven saved — MRP updated from the new recipe", "success");
  });
});
