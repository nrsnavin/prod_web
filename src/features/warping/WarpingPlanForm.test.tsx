import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarpingPlanForm } from "./WarpingPlanForm";

const createMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()
);
const toast = vi.fn();

vi.mock("./hooks", () => ({
  useWarpYarnOptions: () => ({
    data: [
      { id: "y1", name: "Nylon 40D" },
      { id: "y2", name: "Poly 70D" },
    ],
  }),
  useWarpingMutations: () => ({ createPlan: { mutate: createMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const renderForm = () =>
  render(
    <WarpingPlanForm warpingId="w1" jobId="j1" onDone={vi.fn()} onCancel={vi.fn()} />
  );

/** Fills beam `bi`'s first section, adding the beam if it isn't there yet. */
async function fillBeam(user: ReturnType<typeof userEvent.setup>, bi: number, ends: number) {
  const yarns = screen.getAllByLabelText("Warp yarn");
  const endsInputs = screen.getAllByLabelText("Ends");
  await user.selectOptions(yarns[bi], "y1");
  await user.clear(endsInputs[bi]);
  await user.type(endsInputs[bi], String(ends));
}

describe("WarpingPlanForm — combining beams", () => {
  beforeEach(() => {
    createMutate.mockClear();
    toast.mockClear();
  });

  it("offers combining only once there is more than one beam", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByRole("button", { name: /combine beams/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add beam/i }));
    expect(screen.getByRole("button", { name: /combine beams/i })).toBeInTheDocument();
  });

  it("splits the ends across both beams when two are picked", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /add beam/i }));
    await fillBeam(user, 0, 400);
    await fillBeam(user, 1, 200);

    await user.click(screen.getByRole("button", { name: /combine beams/i }));
    await user.click(screen.getByLabelText(/select beam 1 to combine/i));
    await user.click(screen.getByLabelText(/select beam 2 to combine/i));

    // Both beams now carry both sections, each with half the ends.
    await waitFor(() => expect(screen.getAllByLabelText("Ends")).toHaveLength(4));
    const values = screen.getAllByLabelText("Ends").map((i) => (i as HTMLInputElement).value);
    expect(values).toEqual(["200", "100", "200", "100"]);
  });

  it("shows which beam each is now run with", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /add beam/i }));
    await fillBeam(user, 0, 400);
    await fillBeam(user, 1, 200);

    await user.click(screen.getByRole("button", { name: /combine beams/i }));
    await user.click(screen.getByLabelText(/select beam 1 to combine/i));
    await user.click(screen.getByLabelText(/select beam 2 to combine/i));

    expect(await screen.findByText(/run with beam 2/i)).toBeInTheDocument();
    expect(screen.getByText(/run with beam 1/i)).toBeInTheDocument();
  });

  it("leaves combine mode after a pair is made", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /add beam/i }));
    await fillBeam(user, 0, 400);
    await fillBeam(user, 1, 200);

    await user.click(screen.getByRole("button", { name: /combine beams/i }));
    await user.click(screen.getByLabelText(/select beam 1 to combine/i));
    await user.click(screen.getByLabelText(/select beam 2 to combine/i));

    await waitFor(() =>
      expect(screen.queryByLabelText(/select beam 1 to combine/i)).not.toBeInTheDocument()
    );
  });

  it("can be cancelled without changing anything", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /add beam/i }));
    await fillBeam(user, 0, 400);
    await fillBeam(user, 1, 200);

    await user.click(screen.getByRole("button", { name: /combine beams/i }));
    await user.click(screen.getByLabelText(/select beam 1 to combine/i));
    await user.click(screen.getByRole("button", { name: /cancel combining/i }));

    expect(screen.getAllByLabelText("Ends")).toHaveLength(2);
  });

  it("separates a pair again", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /add beam/i }));
    await fillBeam(user, 0, 400);
    await fillBeam(user, 1, 200);

    await user.click(screen.getByRole("button", { name: /combine beams/i }));
    await user.click(screen.getByLabelText(/select beam 1 to combine/i));
    await user.click(screen.getByLabelText(/select beam 2 to combine/i));
    await user.click(await screen.findByLabelText(/separate beam 1 from beam 2/i));

    await waitFor(() => expect(screen.queryByText(/run with beam/i)).not.toBeInTheDocument());
  });

  it("saves the pairing and numbers every beam", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /add beam/i }));
    await fillBeam(user, 0, 400);
    await fillBeam(user, 1, 200);

    await user.click(screen.getByRole("button", { name: /combine beams/i }));
    await user.click(screen.getByLabelText(/select beam 1 to combine/i));
    await user.click(screen.getByLabelText(/select beam 2 to combine/i));
    await user.click(screen.getByRole("button", { name: /create plan/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const body = createMutate.mock.calls[0][0] as {
      beams: Array<{ beamNo: number; pairedBeamNo: number | null; sections: unknown[] }>;
    };
    expect(body.beams.map((b) => b.beamNo)).toEqual([1, 2]);
    expect(body.beams.map((b) => b.pairedBeamNo)).toEqual([2, 1]);
  });

  it("numbers beams even when nothing was combined", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillBeam(user, 0, 400);
    await user.click(screen.getByRole("button", { name: /create plan/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const body = createMutate.mock.calls[0][0] as {
      beams: Array<{ beamNo: number; pairedBeamNo: number | null }>;
    };
    expect(body.beams[0].beamNo).toBe(1);
    expect(body.beams[0].pairedBeamNo).toBeNull();
  });

  it("shows each beam's running ends total", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillBeam(user, 0, 1250);
    expect(await screen.findByText("1,250 ends")).toBeInTheDocument();
  });
});
