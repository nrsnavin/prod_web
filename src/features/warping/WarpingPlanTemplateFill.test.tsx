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
