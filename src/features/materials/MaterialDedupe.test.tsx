import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DuplicateMaterials, SimilarMaterials } from "./SimilarMaterials";

// One yarn under three names: said while a new one is typed, and merged
// into one from the list.

const post = vi.fn(async () => ({ success: true }));
vi.mock("@/core/http/httpClient", () => ({
  httpClient: {
    get: async (url: string) => url.endsWith("/similar")
      ? { similar: [{ _id: "m1", name: "40s PC Black", category: "warp", stock: 100, unit: "kg", sameYarn: true }] }
      : { groups: [{ key: "k", keep: "m2", name: "40s PC Black", stock: 150, warning: null, members: [
        { _id: "m2", name: "40/1 PC BLK", category: "warp", stock: 50, unit: "kg", uses: 4 },
        { _id: "m1", name: "40s PC Black", category: "warp", stock: 100, unit: "kg", uses: 1 },
      ] }] },
    post: (...a: unknown[]) => post(...(a as [])),
  },
  ApiError: class extends Error {},
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("duplicate materials", () => {
  it("asks 'did you mean' for a name that reads as the same yarn", async () => {
    wrap(<SimilarMaterials name="40S P.C blk" category="warp" />);
    expect(await screen.findByRole("note", {}, { timeout: 2000 })).toHaveTextContent("Did you mean 40s PC Black (100 kg)? That reads as the same yarn");
  });

  it("merges a group into the one kept, under the standard name", async () => {
    wrap(<DuplicateMaterials />);
    await userEvent.click(await screen.findByRole("button", { name: /Review and merge/ }));
    expect(screen.getByLabelText("Keep 40/1 PC BLK")).toBeChecked();
    expect(screen.getByText(/with 150 in stock/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Merge 2 into one" }));
    expect(post).toHaveBeenCalledWith("/materials/merge", { into: "m2", from: ["m1"], name: "40s PC Black", proposedName: "40s PC Black" });
  });
});
