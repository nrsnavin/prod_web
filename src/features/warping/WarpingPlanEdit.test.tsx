import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarpingPlanForm, planToBeams } from "./WarpingPlanForm";
import { WarpingPlan, YarnLotStock } from "./types";

// ══════════════════════════════════════════════════════════════════
//  EDITING A SAVED WARPING PLAN
//
//  The form opens on the plan as saved — beams, sections, lots, remarks —
//  not on the template. What the plan names stays named even when today's
//  pickers no longer offer it (a lot drawn down, a yarn dropped), and the
//  change goes back with a reason and the version it was edited from.
// ══════════════════════════════════════════════════════════════════

const updateMutate = vi.fn();
const createMutate = vi.fn();
const toast = vi.fn();
let lotStock: YarnLotStock[] = [];

vi.mock("./hooks", () => ({
  usePlanContext: () => ({
    data: {
      success: true,
      jobId: "j1",
      warpYarns: [{ id: "y1", name: "Nylon 40D" }],
      lotStock,
      templateBeams: [{ elasticId: "e1", elasticName: "20mm", sections: [{ warpYarnId: "y1", ends: 999, maxMeters: 1 }] }],
    },
  }),
  useWarpingMutations: () => ({
    createPlan: { mutate: createMutate, isPending: false },
    updatePlan: { mutate: updateMutate, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const saved: WarpingPlan = {
  _id: "p1",
  __v: 3,
  noOfBeams: 2,
  remarks: "red creel",
  beams: [
    {
      beamNo: 1, tapeNo: 1, elastic: { _id: "e1", name: "20mm" }, pairedBeamNo: null,
      sections: [{ warpYarn: { _id: "y1", name: "Nylon 40D" }, ends: 120, maxMeters: 500, yarnLot: { _id: "L-old", lotNo: "D-4471" }, lotNo: "D-4471", shade: "Ecru" }],
    },
    {
      beamNo: 2, tapeNo: null, elastic: null,
      // A yarn no longer among the elastic's warp yarns.
      sections: [{ warpYarn: { _id: "y9", name: "Old Poly" }, ends: 80, maxMeters: 500, yarnLot: null }],
    },
  ],
};

const renderEdit = () =>
  render(<WarpingPlanForm warpingId="w1" jobId="j1" plan={saved} onDone={vi.fn()} onCancel={vi.fn()} />);

beforeEach(() => {
  [updateMutate, createMutate, toast].forEach((f) => f.mockReset());
  // Today the old lot is not open any more; another is.
  lotStock = [{
    warpYarnId: "y1", warpYarnName: "Nylon 40D", totalAvailable: 300, largestLot: 300,
    lots: [{ id: "L-new", lotNo: "D-5000", shade: "", balance: 300 }],
  } as unknown as YarnLotStock];
});

it("reads a saved plan as the form's beams", () => {
  expect(planToBeams(saved)).toEqual([
    { beamNo: 1, elastic: "e1", tapeNo: 1, pairedBeamNo: null, sections: [{ warpYarn: "y1", ends: 120, maxMeters: 500, yarnLot: "L-old" }] },
    { beamNo: 2, elastic: null, tapeNo: null, pairedBeamNo: null, sections: [{ warpYarn: "y9", ends: 80, maxMeters: 500, yarnLot: "" }] },
  ]);
});

describe("the edit form", () => {
  it("opens on the plan as saved, not the template, keeping its lot and its yarn", () => {
    renderEdit();
    expect((screen.getAllByLabelText("Ends") as HTMLInputElement[]).map((i) => i.value)).toEqual(["120", "80"]);
    expect((screen.getAllByLabelText("Dye lot")[0] as HTMLSelectElement).value).toBe("L-old");
    expect(screen.getByRole("option", { name: "D-4471 · Ecru — on the plan" })).toBeInTheDocument();
    expect((screen.getAllByLabelText("Warp yarn")[1] as HTMLSelectElement).value).toBe("y9");
    expect(screen.getByLabelText("Remarks")).toHaveValue("red creel");
    expect(screen.queryByText(/Filled from the warping template/)).not.toBeInTheDocument();
  });

  it("asks for a reason before it saves", async () => {
    const u = userEvent.setup();
    renderEdit();
    expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
    await u.type(screen.getByLabelText(/Reason for the change/), "ok");
    expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
  });

  it("sends the changed beams with the reason and the version it was edited from", async () => {
    const u = userEvent.setup();
    renderEdit();
    const ends = screen.getAllByLabelText("Ends");
    await u.clear(ends[0]);
    await u.type(ends[0], "140");
    await u.type(screen.getByLabelText(/Reason for the change/), "wider tape");
    await u.click(screen.getByRole("button", { name: "Save plan" }));

    expect(createMutate).not.toHaveBeenCalled();
    const { planId, body } = updateMutate.mock.calls[0][0];
    expect(planId).toBe("p1");
    expect(body).toMatchObject({ auditReason: "wider tape", expectedVersion: 3, remarks: "red creel" });
    expect(body.beams[0]).toMatchObject({ beamNo: 1, elastic: "e1", tapeNo: 1 });
    expect(Number(body.beams[0].sections[0].ends)).toBe(140);
    expect(body.beams[0].sections[0].yarnLot).toBe("L-old");
    expect(body.beams[1].sections[0].warpYarn).toBe("y9");
  });
});
