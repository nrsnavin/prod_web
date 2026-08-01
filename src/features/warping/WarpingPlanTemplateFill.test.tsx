import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { WarpingPlanForm } from "./WarpingPlanForm";
import { PlanContext } from "./types";

// A plan raised by hand should start from the same beams a plan raised
// automatically gets. Typing them again is how one job's programme ends
// up differing from another's for the same product.

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

const baseContext = (): Partial<PlanContext> => ({
  jobId: "j1",
  warpYarns: [
    { id: "y1", name: "Nylon 70D" },
    { id: "y2", name: "Poly 150D" },
  ] as PlanContext["warpYarns"],
  lotStock: [],
  templateBeams: [
    {
      beamNo: 1,
      totalEnds: 120,
      elasticId: "e1",
      elasticName: "20mm",
      sections: [{ warpYarnId: "y1", warpYarnName: "Nylon 70D", ends: 120, maxMeters: 5000 }],
    },
    {
      beamNo: 2,
      totalEnds: 60,
      elasticId: "e2",
      elasticName: "32mm",
      sections: [{ warpYarnId: "y2", warpYarnName: "Poly 150D", ends: 60, maxMeters: 0 }],
    },
  ],
});

const renderForm = () =>
  render(
    <MemoryRouter>
      <WarpingPlanForm warpingId="w1" jobId="j1" onDone={() => {}} onCancel={() => {}} />
    </MemoryRouter>
  );

beforeEach(() => {
  toast.mockClear();
  createMutate.mockClear();
  context = baseContext();
});

describe("filling the plan form from the elastics' templates", () => {
  it("fills the beams as soon as the template arrives", async () => {
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());
    expect(screen.getByText(/filled from the warping template of/i)).toHaveTextContent(/20mm/);
    expect(screen.getByText(/filled from the warping template of/i)).toHaveTextContent(/32mm/);
  });

  it("says which elastic each beam warps, so a mixed job reads", async () => {
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());
    expect(screen.getByText("20mm")).toBeInTheDocument();
    expect(screen.getByText("32mm")).toBeInTheDocument();
  });

  it("saves the template's beams, keeping the elastic on each", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /create plan|save/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const body = createMutate.mock.calls[0][0] as {
      beams: Array<{ beamNo: number; elastic: string | null; sections: Array<{ ends: number }> }>;
    };
    expect(body.beams).toHaveLength(2);
    expect(body.beams[0]).toMatchObject({ beamNo: 1, elastic: "e1" });
    expect(body.beams[1]).toMatchObject({ beamNo: 2, elastic: "e2" });
    expect(body.beams[0].sections[0].ends).toBe(120);
  });

  it("leaves the dye lot unset — that is this run's decision, not the template's", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /create plan|save/i }));

    const body = createMutate.mock.calls[0][0] as {
      beams: Array<{ sections: Array<{ yarnLot?: string }> }>;
    };
    expect(body.beams[0].sections[0].yarnLot).toBe("");
  });

  it("can be emptied, and filled again", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /start empty/i }));
    expect(screen.queryByText("Beam 2")).not.toBeInTheDocument();
    expect(screen.getByText(/have a warping template you can start from/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /use template/i }));
    expect(screen.getByText("Beam 2")).toBeInTheDocument();
  });

  it("says nothing at all when no elastic has a template", () => {
    context = { ...baseContext(), templateBeams: [] };
    renderForm();
    expect(screen.queryByText(/warping template/i)).not.toBeInTheDocument();
    // Still usable by hand: one empty beam to type into.
    expect(screen.getByText("Beam 1")).toBeInTheDocument();
    expect(screen.queryByText("Beam 2")).not.toBeInTheDocument();
  });
});

// ── Tapes, duplication, and one length for all ────────────────────────
// The template describes one tape. A plan usually runs that build several
// times over, and running a single beam twice is routine — retyping it is
// where two copies that should be identical drift apart.

const saveAndRead = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /create plan|save/i }));
  await waitFor(() => expect(createMutate).toHaveBeenCalled());
  return createMutate.mock.calls[createMutate.mock.calls.length - 1][0] as {
    beams: Array<{
      beamNo: number;
      tapeNo: number | null;
      elastic: string | null;
      sections: Array<{ ends: number; maxMeters: number }>;
    }>;
  };
};

describe("repeating the template per tape", () => {
  it("repeats every beam once per tape, numbered straight through", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    const tapesInput = screen.getByLabelText(/number of tapes/i);
    await user.clear(tapesInput);
    await user.type(tapesInput, "3");

    // 2 template beams × 3 tapes.
    await waitFor(() => expect(screen.getByText("Beam 6")).toBeInTheDocument());
    const body = await saveAndRead(user);
    expect(body.beams).toHaveLength(6);
    expect(body.beams.map((b) => b.beamNo)).toEqual([1, 2, 3, 4, 5, 6]);
    // Two beam 1s would be two things with one name.
    expect(new Set(body.beams.map((b) => b.beamNo)).size).toBe(6);
  });

  it("stamps each beam with the tape it belongs to", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    const tapesInput = screen.getByLabelText(/number of tapes/i);
    await user.clear(tapesInput);
    await user.type(tapesInput, "2");
    await waitFor(() => expect(screen.getByText("Beam 4")).toBeInTheDocument());

    const body = await saveAndRead(user);
    expect(body.beams.map((b) => b.tapeNo)).toEqual([1, 1, 2, 2]);
    // Each tape is a full copy, so the elastics repeat with it.
    expect(body.beams.map((b) => b.elastic)).toEqual(["e1", "e2", "e1", "e2"]);
  });

  it("shows the tape on each beam", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());
    const tapesInput = screen.getByLabelText(/number of tapes/i);
    await user.clear(tapesInput);
    await user.type(tapesInput, "2");

    await waitFor(() => expect(screen.getAllByText("Tape 2")).toHaveLength(2));
  });

  it("never goes below one tape", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    const tapesInput = screen.getByLabelText(/number of tapes/i);
    await user.clear(tapesInput);
    await user.type(tapesInput, "0");

    const body = await saveAndRead(user);
    expect(body.beams).toHaveLength(2);
  });
});

describe("duplicating a beam", () => {
  it("copies it in straight after, and renumbers", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /duplicate beam 1/i }));

    const body = await saveAndRead(user);
    expect(body.beams).toHaveLength(3);
    expect(body.beams.map((b) => b.beamNo)).toEqual([1, 2, 3]);
    // The copy sits next to its original and carries its sections.
    expect(body.beams[1].sections[0].ends).toBe(120);
    expect(body.beams[1].elastic).toBe("e1");
    // …and the one that followed is pushed down, not overwritten.
    expect(body.beams[2].sections[0].ends).toBe(60);
  });

  it("copies the sections rather than sharing them", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /duplicate beam 1/i }));

    // Editing the copy must not move the original.
    const beamTwoEnds = screen.getAllByLabelText("Ends")[1];
    await user.clear(beamTwoEnds);
    await user.type(beamTwoEnds, "999");

    const body = await saveAndRead(user);
    expect(body.beams[0].sections[0].ends).toBe(120);
    expect(body.beams[1].sections[0].ends).toBe(999);
  });
});

describe("one length for every section", () => {
  it("writes the shared length into all of them", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    await user.click(screen.getByLabelText(/same length for every section/i));
    const shared = screen.getByLabelText(/shared section length/i);
    await user.clear(shared);
    await user.type(shared, "4000");

    const body = await saveAndRead(user);
    expect(body.beams.flatMap((b) => b.sections).every((s) => s.maxMeters === 4000)).toBe(true);
  });

  it("adopts a length already entered rather than wiping it", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    // The template's first section already carries 5000.
    await user.click(screen.getByLabelText(/same length for every section/i));
    expect(screen.getByLabelText(/shared section length/i)).toHaveValue(5000);

    const body = await saveAndRead(user);
    expect(body.beams.flatMap((b) => b.sections).every((s) => s.maxMeters === 5000)).toBe(true);
  });

  it("locks the per-section fields while it is on", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    expect(screen.getAllByLabelText("Length")[0]).not.toHaveAttribute("readonly");
    await user.click(screen.getByLabelText(/same length for every section/i));
    // Read-only, not disabled — a disabled input would not be submitted.
    expect(screen.getAllByLabelText("Length")[0]).toHaveAttribute("readonly");
  });

  it("lets the per-section fields go again when switched off", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByText("Beam 2")).toBeInTheDocument());

    const toggle = screen.getByLabelText(/same length for every section/i);
    await user.click(toggle);
    await user.click(toggle);
    expect(screen.getAllByLabelText("Length")[0]).not.toHaveAttribute("readonly");
  });
});
