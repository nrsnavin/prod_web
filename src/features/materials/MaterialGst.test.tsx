import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MaterialForm } from "./MaterialForm";
import { RawMaterial } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A MATERIAL'S GST ON BUYING IT
//
//  The HSN and rate a purchase order line takes unless it says
//  otherwise. A blank rate is "the default in Settings" and is sent as
//  null, never as 0% — 0 is a rate of its own (exempt goods).
// ══════════════════════════════════════════════════════════════════

vi.mock("./hooks", () => ({
  useSupplierOptions: () => ({ data: [{ _id: "s1", name: "Yarn Co" }] }),
  useMaterialCategories: () => ({ data: { categories: ["warp", "weft", "covering", "Rubber", "Chemicals"], positions: [] }, isLoading: false }),
}));
vi.mock("../materialGroups/hooks", () => ({ useMaterialGroups: () => ({ data: [], isLoading: false }) }));
vi.mock("./SimilarMaterials", () => ({ SimilarMaterials: () => null }));

const material: RawMaterial = {
  _id: "m1", __v: 3, name: "Nylon 70D", category: "warp", unit: "kg", price: 320, stock: 40, minStock: 10,
  supplier: { _id: "s1", name: "Yarn Co" }, hsn: "5402", gstPercent: 5,
} as RawMaterial;

const renderForm = (props: { initial?: RawMaterial; cloneFrom?: RawMaterial } = {}) => {
  const onSubmit = vi.fn();
  render(<MemoryRouter><MaterialForm {...props} submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} /></MemoryRouter>);
  return onSubmit;
};

describe("HSN and GST % on the material form", () => {
  it("a new material: typed values are sent; a blank rate is sent as the default (null)", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText(/Material name/i), "Latex 20");
    await userEvent.selectOptions(screen.getByLabelText(/Category/i), "Rubber");
    await userEvent.type(screen.getByLabelText("HSN"), "4007");
    await userEvent.click(screen.getByRole("button", { name: /Add material/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ hsn: "4007", gstPercent: null });
  });

  it("an edit loads them and sends a change; 0 stays 0", async () => {
    const onSubmit = renderForm({ initial: material });
    expect(screen.getByLabelText("HSN")).toHaveValue("5402");
    expect(screen.getByLabelText("GST %")).toHaveValue(5);
    await userEvent.clear(screen.getByLabelText("GST %"));
    await userEvent.type(screen.getByLabelText("GST %"), "0");
    await userEvent.click(screen.getByRole("button", { name: /Save changes/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ hsn: "5402", gstPercent: 0 });
  });

  it("a copy carries them, as the same goods taxed the same way", () => {
    renderForm({ cloneFrom: material });
    expect(screen.getByLabelText("HSN")).toHaveValue("5402");
    expect(screen.getByLabelText("GST %")).toHaveValue(5);
  });

  it.each([
    ["HSN", "54", "HSN is 4 to 8 digits"],
    ["GST %", "120", "GST % is 0 to 100"],
  ])("refuses %s %s", async (label, value, message) => {
    const onSubmit = renderForm({ initial: material });
    await userEvent.clear(screen.getByLabelText(label));
    await userEvent.type(screen.getByLabelText(label), value);
    await userEvent.click(screen.getByRole("button", { name: /Save changes/i }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
