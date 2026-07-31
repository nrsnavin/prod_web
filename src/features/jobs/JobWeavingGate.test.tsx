import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { JobDetailPage } from "./JobDetailPage";
import { ApiError } from "@/core/http/httpClient";
import { JobDetail, WeavingReadiness } from "./types";

// A preparatory job may be moved to weaving only once its warping AND
// covering are both completed. These tests pin the user-facing half of
// that rule: the action is offered, and when the server refuses it the
// page shows WHICH stage is open and leaves the status alone.

const toast = vi.fn();
let updateError: unknown = null;
let readiness: WeavingReadiness | undefined;
let job: JobDetail;

const updateMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) =>
    updateError ? opts?.onError?.(updateError) : opts?.onSuccess?.()
);

vi.mock("./hooks", () => ({
  useJob: () => ({ data: job, isLoading: false, isError: false, error: null }),
  useJobSummary: () => ({ data: [], isLoading: false }),
  useWeavingReadiness: () => ({ data: readiness }),
  useJobMutations: () => ({
    updateStatus: { mutate: updateMutate, isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./MachineAssignModal", () => ({ MachineAssignModal: () => null }));
vi.mock("./QcPanel", () => ({ QcPanel: () => null }));
vi.mock("./JobYarnLots", () => ({ JobYarnLots: () => null }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

const makeJob = (over: Partial<JobDetail> = {}): JobDetail =>
  ({
    id: "j1",
    jobNo: "J-12",
    customerName: "Sri Textiles",
    orderNo: 1042,
    status: "preparatory",
    date: "2026-07-01",
    elastics: [],
    shiftDetails: [],
    wastages: [],
    warping: { status: "completed" },
    covering: { status: "in_progress" },
    ...over,
  }) as unknown as JobDetail;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/jobs/j1"]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  toast.mockClear();
  updateMutate.mockClear();
  updateError = null;
  job = makeJob();
  readiness = {
    ready: false,
    jobStatus: "preparatory",
    stages: [
      { stage: "warping", linked: true, status: "completed", done: true },
      { stage: "covering", linked: true, status: "in_progress", done: false },
    ],
    blockers: ["The covering is in progress, not completed"],
  };
});

describe("moving a preparatory job to weaving", () => {
  it("offers the move — the button is where the user learns the answer", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /move to weaving/i })).toBeInTheDocument();
  });

  it("states up front what is holding the job back", () => {
    renderPage();
    expect(screen.getByText(/not ready for weaving/i)).toBeInTheDocument();
    expect(screen.getByText(/covering is in progress, not completed/i)).toBeInTheDocument();
  });

  it("says so when both stages are done", () => {
    readiness = { ready: true, jobStatus: "preparatory", stages: [], blockers: [] };
    renderPage();
    expect(screen.getByText(/both completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/not ready for weaving/i)).not.toBeInTheDocument();
  });

  it("raises an alert listing every blocker when the server refuses", async () => {
    const user = userEvent.setup();
    updateError = new ApiError("Job cannot move to weaving yet — ...", 409, null, "WEAVING_NOT_READY", {
      details: {
        blockers: [
          "The covering is in progress, not completed",
          "No warping has been created for this job",
        ],
      },
    });
    renderPage();

    await user.click(screen.getByRole("button", { name: /move to weaving/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/not ready for weaving/i);
    expect(dialog).toHaveTextContent(/No warping has been created/i);
    // The status is explicitly unchanged, and no error toast piles on.
    expect(dialog).toHaveTextContent(/has kept its status/i);
    expect(toast).not.toHaveBeenCalled();
  });

  it("falls back to the server message when no blockers came back", async () => {
    const user = userEvent.setup();
    updateError = new ApiError("Job cannot move to weaving yet", 409, null, "WEAVING_NOT_READY", {});
    renderPage();

    await user.click(screen.getByRole("button", { name: /move to weaving/i }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/cannot move to weaving yet/i);
  });

  it("still toasts an unrelated failure rather than opening the readiness alert", async () => {
    const user = userEvent.setup();
    updateError = new ApiError("Network is down", 500);
    renderPage();

    await user.click(screen.getByRole("button", { name: /move to weaving/i }));

    expect(toast).toHaveBeenCalledWith("Network is down", "error");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves the job when the server accepts", async () => {
    const user = userEvent.setup();
    readiness = { ready: true, jobStatus: "preparatory", stages: [], blockers: [] };
    renderPage();

    await user.click(screen.getByRole("button", { name: /move to weaving/i }));

    expect(updateMutate.mock.calls[0][0]).toMatchObject({ jobId: "j1", nextStatus: "weaving" });
    expect(toast).toHaveBeenCalledWith("Job moved to weaving", "success");
  });

  it("does not ask about readiness for a job already past preparatory", () => {
    job = makeJob({ status: "weaving" });
    renderPage();
    expect(screen.queryByText(/not ready for weaving/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move to finishing/i })).toBeInTheDocument();
  });
});
