import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MaterialForm } from "./MaterialForm";
import { RawMaterial } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A MATERIAL HAS TWO CLASSIFICATIONS, AND THEY ARE INDEPENDENT
//
//  They used to be one. `category` held the GROUP'S NAME, so this form
//  asked only for a group and let the server derive the rest. The
//  consequence was invisible and expensive: filing a yarn under a
//  group called "Trim Tape" set its category to "Trim Tape" — a value
//  the elastic recipe picker and the MRP sheet cannot read — and the
//  yarn silently disappeared from the warp picker.
//
//  These pin the separation at the UI, because that is where somebody
//  would notice it regressing:
//
//    * category is required and comes from the fixed five
//    * group is optional, and "None" is a real answer
//    * neither picker's options are built from the other
// ══════════════════════════════════════════════════════════════════

vi.mock("./hooks", () => ({
  useSupplierOptions: () => ({ data: [{ _id: "s1", name: "Yarn Co" }] }),
  useMaterialCategories: () => ({
    data: {
      categories: ["warp", "weft", "covering", "Rubber", "Chemicals"],
      positions: ["warp", "weft", "covering"],
    },
    isLoading: false,
  }),
}));

vi.mock("../materialGroups/hooks", () => ({
  useMaterialGroups: () => ({
    data: [
      { _id: "g1", name: "Trim Tape" },
      { _id: "g2", name: "Zip Tape" },
    ],
    isLoading: false,
  }),
}));

const renderForm = (initial?: RawMaterial, onSubmit = vi.fn()) => {
  render(
    <MemoryRouter>
      <MaterialForm
        initial={initial}
        submitting={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    </MemoryRouter>
  );
  return onSubmit;
};

const material = (over: Partial<RawMaterial> = {}): RawMaterial =>
  ({
    _id: "m1",
    name: "Nylon 40D",
    category: "warp",
    stock: 0,
    minStock: 0,
    price: 0,
    ...over,
  }) as RawMaterial;

describe("the material form asks for both", () => {
  it("offers the fixed five as categories", () => {
    renderForm();
    const select = screen.getByLabelText(/Category/i);
    const values = Array.from(select.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value
    );
    for (const c of ["warp", "weft", "covering", "Rubber", "Chemicals"]) {
      expect(values).toContain(c);
    }
  });

  it("does NOT offer groups as categories", () => {
    // The regression that matters. If a group name can be picked as a
    // category, the coupling is back.
    renderForm();
    const select = screen.getByLabelText(/Category/i);
    const labels = Array.from(select.querySelectorAll("option")).map(
      (o) => o.textContent
    );
    expect(labels.join("|")).not.toMatch(/Trim Tape/);
    expect(labels.join("|")).not.toMatch(/Zip Tape/);
  });

  it("offers groups, and None, as the group", () => {
    renderForm();
    const select = screen.getByLabelText(/^Group$/i);
    const labels = Array.from(select.querySelectorAll("option")).map(
      (o) => o.textContent
    );
    expect(labels.join("|")).toMatch(/Trim Tape/);
    expect(labels.join("|")).toMatch(/None/);
  });

  it("does NOT offer categories as groups", () => {
    renderForm();
    const select = screen.getByLabelText(/^Group$/i);
    const values = Array.from(select.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value
    );
    expect(values).not.toContain("warp");
    expect(values).not.toContain("Rubber");
  });

  it("marks the category required and the group not", () => {
    renderForm();
    // The asterisk is how every other required field on this form is
    // marked, so it is the signal a person actually reads.
    expect(screen.getByLabelText(/Category \*/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Group \*/i)).toBeNull();
  });
});

describe("saving", () => {
  it("submits a category with no group", async () => {
    const onSubmit = renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/Category/i), "Rubber");
    await userEvent.type(screen.getByLabelText(/Material name/i), "Latex 20");
    await userEvent.click(screen.getByRole("button", { name: /Add material/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0][0];
    expect(values.category).toBe("Rubber");
    expect(values.group ?? "").toBe("");
  });

  it("submits a category and a group that have nothing to do with each other", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText(/Material name/i), "Nylon 40D");
    await userEvent.selectOptions(screen.getByLabelText(/Category/i), "warp");
    await userEvent.selectOptions(screen.getByLabelText(/^Group$/i), "g1");
    await userEvent.click(screen.getByRole("button", { name: /Add material/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0][0];
    expect(values.category).toBe("warp");
    expect(values.group).toBe("g1");
  });

  it("refuses to submit with no category", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText(/Material name/i), "Unclassified");
    await userEvent.click(screen.getByRole("button", { name: /Add material/i }));

    await waitFor(() =>
      expect(screen.getByText(/Category is required/i)).toBeTruthy()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("a material written before the split", () => {
  it("shows its stale category, labelled, rather than an empty required field", () => {
    // Rows written under the old scheme hold a group name here. Blanking
    // the field would look like data loss; offering it unmarked would
    // hide that it needs correcting. So it is shown and called out.
    renderForm(material({ category: "Trim Tape" }));
    const select = screen.getByLabelText(/Category/i) as HTMLSelectElement;
    expect(select.value).toBe("Trim Tape");
    expect(screen.getByText(/not a category/i)).toBeTruthy();
  });

  it("CONTROL: a valid category is not labelled as stale", () => {
    // Without this, the label could be rendering unconditionally and
    // the assertion above would pass while meaning nothing.
    renderForm(material({ category: "warp" }));
    expect(screen.queryByText(/not a category/i)).toBeNull();
  });
});
