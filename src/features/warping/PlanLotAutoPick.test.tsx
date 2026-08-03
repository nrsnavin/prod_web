import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { WarpingPlanForm } from "./WarpingPlanForm";
import { PlanContext } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE LOT A SECTION STARTS ON
//
//  A beam wants to come off ONE lot — two meeting inside it show as a
//  shade band — so the lot with the most on it is the one most likely
//  to carry the section without a join. That is the choice the
//  programmer was making by hand every time, off the same numbers on
//  the panel above the form.
//
//  A default, not a decision: it fills an empty section, never argues
//  with a deliberate pick, and leaves the section open when the yarn
//  has no lots at all.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const createMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()
);

let context: Partial<PlanContext> | undefined;

vi.mock("./hooks", () => ({
  usePlanContext: () => ({ data: context }),
  useWarpingMutations: () => ({ createPlan: { mutate: createMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const lot = (id: string, lotNo: string, balance: number) => ({
  id,
  lotNo,
  shade: "Ecru",
  balance,
});

const contextWith = (
  lotStock: PlanContext["lotStock"],
  yarnId = "y1"
): Partial<PlanContext> => ({
  jobId: "j1",
  warpYarns: [
    { id: "y1", name: "Nylon 70D" },
    { id: "y2", name: "Poly 150D" },
  ] as PlanContext["warpYarns"],
  lotStock,
  templateBeams: [
    {
      beamNo: 1,
      totalEnds: 120,
      elasticId: "e1",
      elasticName: "20mm",
      sections: [
        { warpYarnId: yarnId, warpYarnName: "Nylon 70D", ends: 120, maxMeters: 5000 },
      ],
    },
  ] as unknown as PlanContext["templateBeams"],
});

const stock = (
  warpYarnId: string,
  lots: Array<{ id: string; lotNo: string; shade: string; balance: number }>
) => ({
  warpYarnId,
  warpYarnName: warpYarnId === "y1" ? "Nylon 70D" : "Poly 150D",
  lots,
  totalAvailable: lots.reduce((t, l) => t + l.balance, 0),
  largestLot: lots.reduce((m, l) => Math.max(m, l.balance), 0),
});

const renderForm = () =>
  render(
    <MemoryRouter>
      <WarpingPlanForm warpingId="w1" jobId="j1" onDone={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>
  );

/** Fill the form from the templates, which is how a section gets a yarn. */
const fillFromTemplate = async (user: ReturnType<typeof userEvent.setup>) => {
  const btn = screen.queryByRole("button", { name: /fill from template/i });
  if (btn) await user.click(btn);
};

const lotSelect = () => screen.getAllByLabelText("Dye lot")[0] as HTMLSelectElement;

beforeEach(() => {
  createMutate.mockClear();
  toast.mockClear();
  context = undefined;
});

describe("the lot a section starts on", () => {
  it("is the biggest lot of that yarn", async () => {
    const user = userEvent.setup();
    context = contextWith([
      stock("y1", [lot("a", "D-1", 40), lot("b", "D-2", 300), lot("c", "D-3", 120)]),
    ]);
    renderForm();
    await fillFromTemplate(user);

    await waitFor(() => expect(lotSelect().value).toBe("b"));
  });

  it("is not the first one the server happened to list", async () => {
    // Sorted-by-arrival would look right on most data and be wrong on
    // exactly the data that matters.
    const user = userEvent.setup();
    context = contextWith([
      stock("y1", [lot("a", "D-1", 500), lot("b", "D-2", 20)]),
    ]);
    renderForm();
    await fillFromTemplate(user);

    await waitFor(() => expect(lotSelect().value).toBe("a"));
  });

  it("marks which option it picked, so the choice is not mistaken for the operator's", async () => {
    const user = userEvent.setup();
    context = contextWith([
      stock("y1", [lot("a", "D-1", 40), lot("b", "D-2", 300)]),
    ]);
    renderForm();
    await fillFromTemplate(user);

    await waitFor(() => expect(lotSelect().value).toBe("b"));
    const chosen = Array.from(lotSelect().options).find((o) => o.value === "b")!;
    expect(chosen.textContent).toMatch(/most stock/);
  });

  it("stays empty when the yarn has no open lots", async () => {
    // Running with no lot is legitimate — undyed yarn has none — and
    // stays available.
    const user = userEvent.setup();
    context = contextWith([stock("y1", [])]);
    renderForm();
    await fillFromTemplate(user);

    expect(lotSelect().value).toBe("");
  });

  it("stays empty when nothing is known about the yarn at all", async () => {
    const user = userEvent.setup();
    context = contextWith([]);
    renderForm();
    await fillFromTemplate(user);

    expect(lotSelect().value).toBe("");
  });
});

describe("what it must not overwrite", () => {
  it("leaves a lot the operator picked", async () => {
    const user = userEvent.setup();
    context = contextWith([
      stock("y1", [lot("a", "D-1", 40), lot("b", "D-2", 300)]),
    ]);
    renderForm();
    await fillFromTemplate(user);
    await waitFor(() => expect(lotSelect().value).toBe("b"));

    // Deliberately away from the biggest — the default must not argue.
    await user.selectOptions(lotSelect(), "a");
    await waitFor(() => expect(lotSelect().value).toBe("a"));
    // And it stays put.
    await new Promise((r) => setTimeout(r, 50));
    expect(lotSelect().value).toBe("a");
  });
});

describe("when the yarn on the row changes", () => {
  it("replaces a lot that belongs to the old yarn", async () => {
    // Changing the yarn used to leave the previous yarn's lot behind,
    // and the server refused the whole plan on save with "lot does not
    // belong to the yarn on that section".
    const user = userEvent.setup();
    context = contextWith([
      stock("y1", [lot("a", "D-1", 300)]),
      stock("y2", [lot("p", "P-1", 90)]),
    ]);
    renderForm();
    await fillFromTemplate(user);
    await waitFor(() => expect(lotSelect().value).toBe("a"));

    await user.selectOptions(screen.getAllByLabelText("Warp yarn")[0], "y2");

    // Never left holding y1's lot.
    await waitFor(() => expect(lotSelect().value).toBe("p"));
  });

  it("clears the stale lot when the new yarn has none", async () => {
    const user = userEvent.setup();
    context = contextWith([
      stock("y1", [lot("a", "D-1", 300)]),
      stock("y2", []),
    ]);
    renderForm();
    await fillFromTemplate(user);
    await waitFor(() => expect(lotSelect().value).toBe("a"));

    await user.selectOptions(screen.getAllByLabelText("Warp yarn")[0], "y2");

    await waitFor(() => expect(lotSelect().value).toBe(""));
  });
});
