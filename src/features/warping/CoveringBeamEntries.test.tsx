import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoveringBeamEntries } from "./CoveringBeamEntries";
import { Covering } from "./types";

const addBeam = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const deleteBeam = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const toast = vi.fn();

vi.mock("./hooks", () => ({
  useCoveringMutations: () => ({
    addBeam: { mutate: addBeam, isPending: false },
    deleteBeam: { mutate: deleteBeam, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const covering: Covering = {
  _id: "c1",
  status: "in_progress",
  job: { _id: "j1", jobOrderNo: 8, customer: { name: "Acme" } },
  elasticPlanned: [],
  beamEntries: [{ _id: "b1", beamNo: 1, weight: 18 }],
  producedWeight: 18,
};

describe("CoveringBeamEntries", () => {
  beforeEach(() => {
    addBeam.mockClear();
    deleteBeam.mockClear();
    toast.mockClear();
  });

  it("adds a beam entry with number and weight", async () => {
    const user = userEvent.setup();
    render(<CoveringBeamEntries covering={covering} />);

    await user.type(screen.getByLabelText(/Beam #/i), "2");
    await user.type(screen.getByLabelText(/Weight/i), "22.5");
    await user.click(screen.getByRole("button", { name: /add beam/i }));

    expect(addBeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", beamNo: 2, weight: 22.5 }),
      expect.anything()
    );
  });

  it("rejects a non-positive weight without calling the API", async () => {
    const user = userEvent.setup();
    render(<CoveringBeamEntries covering={covering} />);

    await user.type(screen.getByLabelText(/Beam #/i), "2");
    await user.type(screen.getByLabelText(/Weight/i), "0");
    await user.click(screen.getByRole("button", { name: /add beam/i }));

    expect(addBeam).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/valid weight/i), "error");
  });

  it("removes an existing beam entry", async () => {
    const user = userEvent.setup();
    render(<CoveringBeamEntries covering={covering} />);

    await user.click(screen.getByRole("button", { name: /remove beam 1/i }));

    expect(deleteBeam).toHaveBeenCalledWith(
      expect.objectContaining({ coveringId: "c1", entryId: "b1" }),
      expect.anything()
    );
  });

  it("locks editing once the covering is completed", () => {
    render(<CoveringBeamEntries covering={{ ...covering, status: "completed" }} />);
    expect(screen.queryByRole("button", { name: /add beam/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove beam/i })).not.toBeInTheDocument();
  });
});
