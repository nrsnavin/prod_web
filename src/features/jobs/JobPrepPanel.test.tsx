import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/core/http/httpClient";
import { JobPrepPanel } from "./JobPrepPanel";

// The job page's warping and covering card: where each stands, the way
// to it and to the warping's plan, and Start / Complete from the job.

let plan: { isLoading: boolean; data?: { exists: boolean; plan?: { beams: unknown[]; noOfBeams: number } } } = { isLoading: false, data: { exists: false } };
const planFor = vi.fn();
const start = vi.fn();
const complete = vi.fn();
vi.mock("@/features/warping/hooks", () => ({
  useWarpingPlan: (id?: string) => { planFor(id); return plan; },
  useWarpingMutations: () => ({
    start: { mutate: start, isPending: false },
    complete: { mutate: complete, isPending: false },
  }),
}));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
let user: { role: string; department: string; features?: string[] } | null = { role: "admin", department: "admin" };
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));

type Job = Parameters<typeof JobPrepPanel>[0]["job"];
const job = (over: Partial<Job> = {}): Job => ({
  status: "preparatory",
  warping: { _id: "w1", status: "open" },
  covering: { _id: "c1", status: "in_progress" },
  ...over,
});
const renderPanel = (j: Job) => render(<MemoryRouter><JobPrepPanel job={j} /></MemoryRouter>);
const warpingCard = () => screen.getByRole("region", { name: "Warping" });

beforeEach(() => {
  plan = { isLoading: false, data: { exists: false } };
  planFor.mockReset();
  start.mockReset();
  complete.mockReset();
  toast.mockReset();
  user = { role: "admin", department: "admin" };
});

describe("the warping and covering card", () => {
  it("shows both statuses with links to each record", () => {
    renderPanel(job());
    expect(within(warpingCard()).getByText("open")).toBeInTheDocument();
    expect(within(warpingCard()).getByRole("link", { name: /open warping/i })).toHaveAttribute("href", "/warping/w1");
    const covering = screen.getByRole("region", { name: "Covering" });
    expect(within(covering).getByText("in progress")).toBeInTheDocument();
    expect(within(covering).getByRole("link", { name: /open covering/i })).toHaveAttribute("href", "/covering/c1");
  });

  it("with no plan: links to create it, and Start waits for one", () => {
    renderPanel(job());
    expect(planFor).toHaveBeenCalledWith("w1");
    expect(within(warpingCard()).getByText("No plan yet")).toBeInTheDocument();
    expect(within(warpingCard()).getByRole("link", { name: /create the plan/i })).toHaveAttribute("href", "/warping/w1?plan=create#plan");
    const startBtn = within(warpingCard()).getByRole("button", { name: /start warping/i });
    expect(startBtn).toBeDisabled();
    expect(startBtn).toHaveAttribute("title", "Create a warping plan before starting");
  });

  it("with a plan: links to it, and starts the warping from the job", async () => {
    plan = { isLoading: false, data: { exists: true, plan: { beams: [{}, {}, {}], noOfBeams: 3 } } };
    renderPanel(job());
    expect(within(warpingCard()).getByText("Plan: 3 beams")).toBeInTheDocument();
    expect(within(warpingCard()).getByRole("link", { name: /view plan/i })).toHaveAttribute("href", "/warping/w1#plan");
    start.mockImplementation((_id, opts) => opts.onSuccess());
    await userEvent.click(within(warpingCard()).getByRole("button", { name: /start warping/i }));
    expect(start).toHaveBeenCalledWith("w1", expect.anything());
    expect(toast).toHaveBeenCalledWith("Warping started", "success");
  });

  it("completes a warping in progress", async () => {
    plan = { isLoading: false, data: { exists: true, plan: { beams: [{}], noOfBeams: 1 } } };
    renderPanel(job({ warping: { _id: "w1", status: "in_progress" } }));
    expect(within(warpingCard()).queryByRole("button", { name: /start warping/i })).not.toBeInTheDocument();
    complete.mockImplementation((_v, opts) => opts.onSuccess());
    await userEvent.click(within(warpingCard()).getByRole("button", { name: /complete warping/i }));
    expect(complete).toHaveBeenCalledWith({ id: "w1", forceReason: undefined }, expect.anything());
    expect(toast).toHaveBeenCalledWith("Warping completed", "success");
  });

  it("holds the yarn-not-issued refusal on screen, with the way through and Complete anyway", async () => {
    plan = { isLoading: false, data: { exists: true, plan: { beams: [{}], noOfBeams: 1 } } };
    renderPanel(job({ warping: { _id: "w1", status: "in_progress" } }));
    complete.mockImplementationOnce((_v, opts) =>
      opts.onError(new ApiError("2 batches are not issued yet", 409, undefined, "WARPING_YARN_NOT_ISSUED")));
    await userEvent.click(within(warpingCard()).getByRole("button", { name: /complete warping/i }));

    const alert = within(warpingCard()).getByRole("alert");
    expect(alert).toHaveTextContent(/yarn is still on the rack/);
    expect(alert).toHaveTextContent("2 batches are not issued yet");
    expect(within(alert).getByRole("link", { name: /issue the batch/i })).toHaveAttribute("href", "/warping/w1");
    expect(toast).not.toHaveBeenCalled();

    await userEvent.click(within(alert).getByRole("button", { name: /complete anyway/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Beams already on the loom");
    await userEvent.click(within(dialog).getByRole("button", { name: /complete anyway/i }));
    expect(complete).toHaveBeenLastCalledWith({ id: "w1", forceReason: "Beams already on the loom" }, expect.anything());
  });

  it("offers no actions on a completed warping, or once the job is closed", () => {
    renderPanel(job({ warping: { _id: "w1", status: "completed" } }));
    expect(within(warpingCard()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(warpingCard()).getByText("completed")).toBeInTheDocument();
  });

  it("for someone who cannot open the warping screens: status only, nothing fetched", () => {
    user = { role: "accounts", department: "finance", features: ["/jobs"] };
    renderPanel(job());
    expect(planFor).toHaveBeenCalledWith(undefined);
    expect(within(warpingCard()).getByText("open")).toBeInTheDocument();
    expect(within(warpingCard()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(warpingCard()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when the job has no warping or covering", () => {
    renderPanel(job({ warping: null, covering: { _id: "c1", status: "open" } }));
    expect(screen.getByText("No warping on this job.")).toBeInTheDocument();
  });
});
