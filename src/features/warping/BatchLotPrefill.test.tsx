import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewBatchForm } from "./WarpingBatches";
import type { WarpingPlan } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE LOT THE PROGRAMME ALREADY CHOSE
//
//  The lot is decided when the warping programme is written — that is
//  the point of choosing it there, because two lots meeting inside one
//  beam show as a shade band in the finished elastic.
//
//  The batch form then asked for it again from an empty picker. So the
//  operator re-keyed a decision already made and printed on the sheet
//  at the machine, and could pick a different lot without anything
//  saying so.
//
//  It fills in from the programme now. A default, not a lock: a lot can
//  genuinely run out between programming and warping.
// ══════════════════════════════════════════════════════════════════

const lots = [
  { _id: "lotA", lotNo: "D-4471", shade: "Ecru", balance: 120 },
  { _id: "lotB", lotNo: "D-4472", shade: "Ecru", balance: 80 },
];
let availableLots = lots;

vi.mock("@/features/materials/hooks", () => ({
  useYarnLots: () => ({ data: availableLots, isLoading: false }),
}));
vi.mock("./hooks", () => ({
  useYarnLots: () => ({ data: availableLots, isLoading: false }),
}));

const yarn = (id: string, name: string) => ({ _id: id, name });

/** A plan whose beams name lots per section. */
const plan = (
  beams: Array<{ beamNo: number; sections: Array<{ yarn: string; lot: string | null }> }>
): WarpingPlan =>
  ({
    beams: beams.map((b) => ({
      beamNo: b.beamNo,
      totalEnds: 480,
      sections: b.sections.map((s) => ({
        warpYarn: yarn(s.yarn, s.yarn === "y1" ? "Nylon 70D" : "Spandex 40D"),
        ends: 240,
        yarnLot: s.lot ? { _id: s.lot, lotNo: s.lot === "lotA" ? "D-4471" : "D-4472" } : null,
      })),
    })),
  }) as unknown as WarpingPlan;

const onSubmit = vi.fn();

const renderForm = (p: WarpingPlan) =>
  render(
    <NewBatchForm
      plan={p}
      elasticOptions={[]}
      submitting={false}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />
  );

const lotSelect = (yarnName: string) =>
  screen.getByLabelText(`Dye lot for ${yarnName}`) as HTMLSelectElement;

beforeEach(() => {
  onSubmit.mockClear();
  availableLots = lots;
});

describe("the lot the programme chose", () => {
  it("is filled in without the operator picking it", () => {
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));
    expect(lotSelect("Nylon 70D").value).toBe("lotA");
  });

  it("says where the choice came from", () => {
    // So a filled picker is not mistaken for one the operator set, or
    // for a blank they missed.
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));
    expect(screen.getByText(/From the warping programme — lot D-4471/)).toBeInTheDocument();
  });

  it("marks the programmed lot in the list of options", () => {
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));
    const opts = within(lotSelect("Nylon 70D")).getAllByRole("option");
    expect(opts.find((o) => (o as HTMLOptionElement).value === "lotA")!.textContent)
      .toMatch(/programmed/);
  });

  it("fills each yarn from its own section", () => {
    renderForm(
      plan([
        {
          beamNo: 1,
          sections: [
            { yarn: "y1", lot: "lotA" },
            { yarn: "y2", lot: "lotB" },
          ],
        },
      ])
    );
    expect(lotSelect("Nylon 70D").value).toBe("lotA");
    expect(lotSelect("Spandex 40D").value).toBe("lotB");
  });

  it("leaves the picker empty when the programme named no lot", () => {
    // Programming without a lot is legitimate — undyed yarn has none.
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: null }] }]));
    expect(lotSelect("Nylon 70D").value).toBe("");
  });
});

describe("when the beams disagree", () => {
  const mixed = plan([
    { beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] },
    { beamNo: 2, sections: [{ yarn: "y1", lot: "lotB" }] },
  ]);

  it("fills nothing rather than guessing", () => {
    // Two lots for one yarn across the covered beams has no single right
    // answer, and a filled-in guess is one the operator would accept.
    renderForm(mixed);
    expect(lotSelect("Nylon 70D").value).toBe("");
  });

  it("fills in once the batch is narrowed to one beam", async () => {
    const user = userEvent.setup();
    renderForm(mixed);
    expect(lotSelect("Nylon 70D").value).toBe("");

    await user.click(screen.getByText("Beam 2"));
    expect(lotSelect("Nylon 70D").value).toBe("lotB");
  });
});

describe("the operator overriding it", () => {
  it("keeps a hand-picked lot when another beam is ticked", async () => {
    // The pre-fill must not argue with a deliberate correction.
    const user = userEvent.setup();
    renderForm(
      plan([
        { beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] },
        { beamNo: 2, sections: [{ yarn: "y1", lot: "lotA" }] },
      ])
    );

    await user.selectOptions(lotSelect("Nylon 70D"), "lotB");
    await user.click(screen.getByText("Beam 1"));

    expect(lotSelect("Nylon 70D").value).toBe("lotB");
  });

  it("warns that this is not what the programme says", async () => {
    const user = userEvent.setup();
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));

    await user.selectOptions(lotSelect("Nylon 70D"), "lotB");

    expect(screen.getByText(/programme says lot D-4471/i)).toBeInTheDocument();
    expect(screen.getByText(/shade band/i)).toBeInTheDocument();
  });

  it("allows it — the lot may have run out since", async () => {
    const user = userEvent.setup();
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));

    await user.selectOptions(lotSelect("Nylon 70D"), "lotB");
    expect(lotSelect("Nylon 70D").value).toBe("lotB");
  });
});

describe("when the programmed lot cannot be drawn", () => {
  it("says so rather than looking like nothing was programmed", async () => {
    // Exhausted, quarantined, or issued elsewhere since. A silent empty
    // picker here reads as "the programme never chose one".
    availableLots = [lots[1]];
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));

    expect(
      await screen.findByText(/lot the programme chose is not available to issue/i)
    ).toBeInTheDocument();
  });
});

describe("what the batch submits", () => {
  it("does not invent a quantity for the pre-filled lot", () => {
    // Programming names the lot; it does not weigh it. A kilogram figure
    // nobody measured would be believed — and a pre-filled lot must not
    // make the batch look ready to issue when nothing has been weighed.
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));

    expect(
      (screen.getByLabelText("Quantity from lot for Nylon 70D") as HTMLInputElement).value
    ).toBe("");
    // The lot alone is not an allocation, so there is still nothing to
    // create — the form says so rather than submitting an empty draw.
    expect(screen.getByRole("button", { name: /create batch/i })).toBeDisabled();
  });

  it("submits the programme's lot once a quantity is given", async () => {
    const user = userEvent.setup();
    renderForm(plan([{ beamNo: 1, sections: [{ yarn: "y1", lot: "lotA" }] }]));

    await user.type(screen.getByLabelText("Quantity from lot for Nylon 70D"), "42");
    await user.click(screen.getByRole("button", { name: /create batch/i }));

    expect(onSubmit.mock.calls[0][0].allocations).toEqual([
      { rawMaterial: "y1", yarnLot: "lotA", quantity: 42 },
    ]);
  });
});
