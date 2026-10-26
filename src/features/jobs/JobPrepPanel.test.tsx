import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/core/http/httpClient";
import { JobPrepPanel } from "./JobPrepPanel";

// The job page's warping and covering card, fed by what GET /job/:id
// sends: links to both records, the warping's plan (create or view),
// Start / Complete warping, and Add covering beam — from the job.

const start = vi.fn();
const complete = vi.fn();
const addBeam = vi.fn();
vi.mock("@/features/warping/hooks", () => ({
  useWarpingMutations: () => ({
    start: { mutate: start, isPending: false },
    complete: { mutate: complete, isPending: false },
  }),
  useCoveringMutations: () => ({ addBeam: { mutate: addBeam, isPending: false } }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
let user: { role: string; department: string; features?: string[] } | null = { role: "admin", department: "admin" };
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));

type Job = Parameters<typeof JobPrepPanel>[0]["job"];
const job = (over: Partial<Job> = {}): Job => ({
  status: "preparatory",
  warping: { _id: "w1", status: "open", hasPlan: false, noOfBeams: 0 },
  covering: { _id: "c1", status: "in_progress", beamEntries: [], producedWeight: 0 },
  ...over,
});
const renderPanel = (j: Job) => render(<MemoryRouter><JobPrepPanel job={j} /></MemoryRouter>);
const warping = () => screen.getByRole("region", { name: "Warping" });
const covering = () => screen.getByRole("region", { name: "Covering" });

beforeEach(() => {
  start.mockReset();
  complete.mockReset();
  addBeam.mockReset();
  toast.mockReset();
  user = { role: "admin", department: "admin" };
});

describe("the warping", () => {
  it("is a link to its page, says it has not started, and offers to create the plan", () => {
    renderPanel(job());
    expect(within(warping()).getByRole("link", { name: /^warping/i })).toHaveAttribute("href", "/warping/w1");
    expect(within(warping()).getByText("Not started")).toBeInTheDocument();
    expect(within(warping()).getByText("No warping plan yet")).toBeInTheDocument();
    expect(within(warping()).getByRole("link", { name: /create warping plan/i })).toHaveAttribute("href", "/warping/w1?plan=create#plan");
    const startBtn = within(warping()).getByRole("button", { name: /start warping/i });
    expect(startBtn).toBeDisabled();
    expect(startBtn).toHaveAttribute("title", "Create a warping plan before starting");
  });

  it("with a plan: view it, and start the warping from the job", async () => {
    renderPanel(job({ warping: { _id: "w1", status: "open", hasPlan: true, noOfBeams: 5 } }));
    expect(within(warping()).getByText("Warping plan made — 5 beams")).toBeInTheDocument();
    expect(within(warping()).getByRole("link", { name: /view warping plan/i })).toHaveAttribute("href", "/warping/w1#plan");
    expect(within(warping()).queryByRole("link", { name: /create warping plan/i })).not.toBeInTheDocument();
    start.mockImplementation((_id, opts) => opts.onSuccess());
    await userEvent.click(within(warping()).getByRole("button", { name: /start warping/i }));
    expect(start).toHaveBeenCalledWith("w1", expect.anything());
    expect(toast).toHaveBeenCalledWith("Warping started", "success");
  });

  it("in progress: completes it, and holds the yarn-not-issued refusal with Complete anyway", async () => {
    renderPanel(job({ warping: { _id: "w1", status: "in_progress", hasPlan: true, noOfBeams: 2 } }));
    expect(within(warping()).getByText("In progress")).toBeInTheDocument();
    complete.mockImplementationOnce((_v, opts) =>
      opts.onError(new ApiError("2 batches are not issued yet", 409, undefined, "WARPING_YARN_NOT_ISSUED")));
    await userEvent.click(within(warping()).getByRole("button", { name: /complete warping/i }));
    const alert = within(warping()).getByRole("alert");
    expect(alert).toHaveTextContent("2 batches are not issued yet");
    await userEvent.click(within(alert).getByRole("button", { name: /complete anyway/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Beams already on the loom");
    await userEvent.click(within(dialog).getByRole("button", { name: /complete anyway/i }));
    expect(complete).toHaveBeenLastCalledWith({ id: "w1", forceReason: "Beams already on the loom" }, expect.anything());
  });

  it("completed: says so, with the plan to view and nothing to press", () => {
    renderPanel(job({ warping: { _id: "w1", status: "completed", hasPlan: true, noOfBeams: 2 } }));
    expect(within(warping()).getByText("Completed")).toBeInTheDocument();
    expect(within(warping()).queryByRole("button", { name: /start|complete/i })).not.toBeInTheDocument();
    expect(within(warping()).getByRole("link", { name: /view warping plan/i })).toBeInTheDocument();
  });
});

describe("the covering", () => {
  it("is a link to its page, with the beams weighed so far", () => {
    renderPanel(job({ covering: { _id: "c1", status: "in_progress", beamEntries: [{ _id: "b1", beamNo: 1, weight: 12.5 }, { _id: "b2", beamNo: 2, weight: 12.25 }], producedWeight: 24.75 } }));
    expect(within(covering()).getByRole("link", { name: /^covering/i })).toHaveAttribute("href", "/covering/c1");
    expect(within(covering()).getByText("In progress")).toBeInTheDocument();
    expect(within(covering()).getByText("2 beams weighed · 24.75 kg")).toBeInTheDocument();
    expect(within(covering()).getByText(/Beam 1: 12\.50 kg · Beam 2: 12\.25 kg/)).toBeInTheDocument();
  });

  it("adds a covering beam from the job, numbered next", async () => {
    renderPanel(job({ covering: { _id: "c1", status: "in_progress", beamEntries: [{ _id: "b1", beamNo: 1, weight: 12.5 }], producedWeight: 12.5 } }));
    await userEvent.click(within(covering()).getByRole("button", { name: /add covering beam/i }));
    const dialog = await screen.findByRole("dialog", { name: /add covering beam/i });
    expect(within(dialog).getByLabelText("Beam #")).toHaveValue(2);
    await userEvent.type(within(dialog).getByLabelText("Weight (kg)"), "13.1");
    addBeam.mockImplementation((_v, opts) => opts.onSuccess());
    await userEvent.click(within(dialog).getByRole("button", { name: /add beam/i }));
    expect(addBeam).toHaveBeenCalledWith({ id: "c1", beamNo: 2, weight: 13.1, note: undefined }, expect.anything());
    expect(toast).toHaveBeenCalledWith("Beam 2 added — 13.10 kg", "success");
  });

  it("refuses a beam number already weighed, and a missing weight, before asking the server", async () => {
    renderPanel(job({ covering: { _id: "c1", status: "open", beamEntries: [{ _id: "b1", beamNo: 1, weight: 12 }], producedWeight: 12 } }));
    await userEvent.click(within(covering()).getByRole("button", { name: /add covering beam/i }));
    const dialog = await screen.findByRole("dialog", { name: /add covering beam/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /add beam/i }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/weight in kg/);
    await userEvent.clear(within(dialog).getByLabelText("Beam #"));
    await userEvent.type(within(dialog).getByLabelText("Beam #"), "1");
    await userEvent.type(within(dialog).getByLabelText("Weight (kg)"), "10");
    await userEvent.click(within(dialog).getByRole("button", { name: /add beam/i }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Beam 1 is weighed already/);
    expect(addBeam).not.toHaveBeenCalled();
  });

  it("offers no beam to add once the covering is completed, or the job is closed", () => {
    renderPanel(job({ covering: { _id: "c1", status: "completed", beamEntries: [], producedWeight: 0 } }));
    expect(within(covering()).queryByRole("button", { name: /add covering beam/i })).not.toBeInTheDocument();
  });
});

describe("for someone who cannot open the warping or covering screens", () => {
  it("shows where each stands, with no links or buttons", () => {
    user = { role: "accounts", department: "finance", features: ["/jobs"] };
    renderPanel(job({ warping: { _id: "w1", status: "open", hasPlan: true, noOfBeams: 2 } }));
    expect(within(warping()).getByText("Not started")).toBeInTheDocument();
    expect(within(warping()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(warping()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(covering()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(covering()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when the job has no warping", () => {
    renderPanel(job({ warping: null }));
    expect(screen.getByText("No warping on this job.")).toBeInTheDocument();
  });
});
