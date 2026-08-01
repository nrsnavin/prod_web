import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ElasticWarpingTemplate } from "./ElasticWarpingTemplate";
import { formToTemplate, templateToForm } from "./WarpingTemplateEditor";
import { Elastic } from "./types";

// An elastic is warped the same way every time it runs. Recording that
// on the product means a job carrying it starts already programmed
// rather than being retyped — so the template has to be reachable from
// the product: edited when there is one, created when there is not.

const toast = vi.fn();
const saveMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()
);

vi.mock("./hooks", () => ({
  useElasticMutations: () => ({ saveTemplate: { mutate: saveMutate, isPending: false } }),
  useMaterialsByCategory: () => ({
    data: { warp: [{ _id: "y1", name: "Nylon 70D" }, { _id: "y2", name: "Poly 150D" }] },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const elastic = (tpl?: Elastic["warpingPlanTemplate"]): Elastic =>
  ({ _id: "e1", name: "20mm", warpingPlanTemplate: tpl }) as Elastic;

const withTemplate = elastic({
  noOfBeams: 1,
  beams: [
    {
      beamNo: 1,
      totalEnds: 200,
      sections: [
        { warpYarn: { _id: "y1", name: "Nylon 70D" }, ends: 120, maxMeters: 5000 },
        { warpYarn: { _id: "y2", name: "Poly 150D" }, ends: 80 },
      ],
    },
  ],
});

const renderCard = (e: Elastic) =>
  render(
    <MemoryRouter>
      <ElasticWarpingTemplate elastic={e} />
    </MemoryRouter>
  );

beforeEach(() => {
  toast.mockClear();
  saveMutate.mockClear();
});

describe("the template on the elastic detail page", () => {
  it("offers Create when the product has no template", () => {
    renderCard(elastic(undefined));
    expect(screen.getByRole("button", { name: /create template/i })).toBeInTheDocument();
    expect(screen.getByText(/planned by hand/i)).toBeInTheDocument();
  });

  it("offers Edit and shows the beams when it does", () => {
    renderCard(withTemplate);
    expect(screen.getByRole("button", { name: /edit template/i })).toBeInTheDocument();

    expect(screen.getByText("Beam 1")).toBeInTheDocument();
    expect(screen.getByText("200 ends")).toBeInTheDocument();
    expect(screen.getByText("Nylon 70D")).toBeInTheDocument();
    expect(screen.getByText("5,000")).toBeInTheDocument();
  });

  it("opens the editor seeded with what is already recorded", async () => {
    const user = userEvent.setup();
    renderCard(withTemplate);
    await user.click(screen.getByRole("button", { name: /edit template/i }));

    const ends = screen.getByLabelText(/ends for beam 1 section 1/i);
    expect(ends).toHaveValue(120);
  });

  it("starts a creator on one empty beam rather than nothing to type into", async () => {
    const user = userEvent.setup();
    renderCard(elastic(undefined));
    await user.click(screen.getByRole("button", { name: /create template/i }));

    expect(screen.getByLabelText(/ends for beam 1 section 1/i)).toBeInTheDocument();
  });

  it("saves the edited template against the elastic", async () => {
    const user = userEvent.setup();
    renderCard(withTemplate);
    await user.click(screen.getByRole("button", { name: /edit template/i }));

    const ends = screen.getByLabelText(/ends for beam 1 section 1/i);
    await user.clear(ends);
    await user.type(ends, "150");
    await user.click(screen.getByRole("button", { name: /save template/i }));

    expect(saveMutate).toHaveBeenCalledTimes(1);
    const arg = saveMutate.mock.calls[0][0] as {
      id: string;
      template?: { beams: Array<{ sections: Array<{ ends: number }> }> };
    };
    expect(arg.id).toBe("e1");
    expect(arg.template!.beams[0].sections[0].ends).toBe(150);
    expect(toast).toHaveBeenCalledWith("Warping template saved", "success");
  });

  it("calls emptying every beam a removal, not a failed save", async () => {
    const user = userEvent.setup();
    renderCard(withTemplate);
    await user.click(screen.getByRole("button", { name: /edit template/i }));
    await user.click(screen.getByRole("button", { name: /remove beam 1/i }));
    await user.click(screen.getByRole("button", { name: /save template/i }));

    expect((saveMutate.mock.calls[0][0] as { template?: unknown }).template).toBeUndefined();
    expect(toast).toHaveBeenCalledWith("Warping template removed", "success");
  });

  it("adds beams and sections", async () => {
    const user = userEvent.setup();
    renderCard(withTemplate);
    await user.click(screen.getByRole("button", { name: /edit template/i }));

    await user.click(screen.getByRole("button", { name: /add beam/i }));
    expect(screen.getByLabelText(/ends for beam 2 section 1/i)).toBeInTheDocument();

    const beamTwo = screen.getByRole("group", { name: "Beam 2" });
    await user.click(within(beamTwo).getByRole("button", { name: /add section/i }));
    expect(screen.getByLabelText(/ends for beam 2 section 2/i)).toBeInTheDocument();
  });
});

describe("template <-> form conversion", () => {
  it("reads a populated yarn and a bare id the same", () => {
    const beams = templateToForm({
      beams: [
        { beamNo: 1, sections: [{ warpYarn: { _id: "y1" }, ends: 10 }] },
        { beamNo: 2, sections: [{ warpYarn: "y2", ends: 20 }] },
      ],
    });
    expect(beams[0].sections[0].warpYarn).toBe("y1");
    expect(beams[1].sections[0].warpYarn).toBe("y2");
  });

  it("drops the half-filled rows an abandoned edit leaves behind", () => {
    const out = formToTemplate([
      { beamNo: 1, sections: [{ warpYarn: "y1", ends: 100, maxMeters: 0 }, { warpYarn: "", ends: 0, maxMeters: 0 }] },
      { beamNo: 2, sections: [{ warpYarn: "", ends: 0, maxMeters: 0 }] },
    ]);
    expect(out!.beams).toHaveLength(1);
    expect(out!.beams[0].sections).toHaveLength(1);
  });

  it("returns undefined when nothing was entered, so the API clears it", () => {
    // An array of blanks is not a template, and sending one would store
    // a beam nobody meant to create.
    expect(formToTemplate([])).toBeUndefined();
    expect(formToTemplate([{ beamNo: 1, sections: [{ warpYarn: "", ends: 0, maxMeters: 0 }] }])).toBeUndefined();
  });

  it("renumbers beams from their position, not from stale numbers", () => {
    const out = formToTemplate([
      { beamNo: 7, sections: [{ warpYarn: "y1", ends: 10, maxMeters: 0 }] },
    ]);
    expect(out!.beams[0].beamNo).toBe(7);
  });
});
