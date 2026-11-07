import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ElasticForm } from "./ElasticForm";

// A tech sheet or sample photo fills the new-elastic form: the numbers,
// each yarn it could match, and a note of what to check.

vi.mock("./hooks", () => ({
  useMaterialsByCategory: () => ({
    data: {
      warp: [{ _id: "y1", name: "40s PC Black" }],
      weft: [{ _id: "w1", name: "150D Polyester" }],
      rubber: [{ _id: "r1", name: "Spandex 840D" }],
      covering: [{ _id: "c1", name: "40D Nylon Covering" }],
    },
  }),
}));

const body = {
  success: true, aiSuggestion: "ai7",
  read: { problem: null, name: "25mm Knitted Elastic Black", weaveType: "Knitted", spandexEnds: 40, yarnEnds: 120, pick: 12, noOfHook: 8, weight: 2.4, hsn: "5806", unclear: ["pick"] },
  matches: {
    warpSpandex: { text: "spandex 840D", weight: 0.6, materialId: "r1", materialName: "Spandex 840D" },
    spandexCovering: { text: "40D nylon", weight: 0.2, materialId: "c1", materialName: "40D Nylon Covering" },
    weftYarn: { text: "150D poly", weight: 0.7, materialId: "w1", materialName: "150D Polyester" },
    warpYarn: [{ text: "40s PC black", weight: 0.9, materialId: "y1", materialName: "40s PC Black" }, { text: "20s cotton white", weight: 0.3, materialId: null, materialName: null }],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("filling an elastic from a tech sheet", () => {
  it("fills what was read, picks the yarns it matched, says what to check, and saves the reading with it", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    const onSubmit = vi.fn();
    render(<ElasticForm submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);
    const file = new File([new Uint8Array([1, 2, 3])], "sheet.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("tech sheet photo"), file);
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/elastic/read-spec", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText("Filled in from the tech sheet — check each field.")).toBeInTheDocument();
    expect(screen.getByLabelText("Elastic name *")).toHaveValue("25mm Knitted Elastic Black");
    expect(screen.getByLabelText("Pick")).toHaveValue(12);
    expect(screen.getByLabelText("Weight (g/m)")).toHaveValue(2.4);
    expect(screen.getByRole("note")).toHaveTextContent("“20s cotton white” not matched — pick it or add it · unsure of pick");
    // The matched yarns are picked.
    for (const y of ["Spandex 840D", "40D Nylon Covering", "150D Polyester", "40s PC Black"]) expect(screen.getByText(y)).toBeInTheDocument();
  });

  it("is offered only for a new elastic", () => {
    render(<ElasticForm initial={{ _id: "e1", name: "Old" } as never} submitting={false} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole("button", { name: /tech sheet/ })).not.toBeInTheDocument();
  });
});
