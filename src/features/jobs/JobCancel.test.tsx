import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { JobDetailPage } from "./JobDetailPage";
import type { JobCancelResult } from "./api";
import { JobDetail } from "./types";

// Cancelling a job cancels the warping and covering that were preparing
// it. The dialog has to say so before the button is pressed, and when a
// warping could not be cancelled (yarn has been issued on a batch) the
// page has to pass on what the server says to do about it — "Job
// cancelled" alone would leave that warping open with nobody told.

const toast = vi.fn();
let cancelResult: JobCancelResult;
const cancelMutate = vi.fn(
  (_a: unknown, opts?: { onSuccess?: (res: JobCancelResult) => void }) => opts?.onSuccess?.(cancelResult)
);

vi.mock("./hooks", () => ({
  useJob: () => ({ data: job, isLoading: false, isError: false, error: null }),
  useJobSummary: () => ({ data: [], isLoading: false }),
  useWeavingReadiness: () => ({ data: undefined }),
  useJobMutations: () => ({
    updateStatus: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: cancelMutate, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./MachineAssignModal", () => ({ MachineAssignModal: () => null }));
vi.mock("./QcPanel", () => ({ QcPanel: () => null }));
vi.mock("./JobYarnLots", () => ({ JobYarnLots: () => null }));
vi.mock("./JobPrepPanel", () => ({ JobPrepPanel: () => null }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

const job = {
  id: "j1",
  jobNo: "J-12",
  customerName: "Sri Textiles",
  orderNo: 1042,
  status: "preparatory",
  date: "2026-07-01",
  elastics: [],
  shiftDetails: [],
  wastages: [],
  warping: { status: "in_progress" },
  covering: { status: "open" },
} as unknown as JobDetail;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/jobs/j1"]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

/** Open the cancel dialog from wherever the page offers it. */
async function openCancelDialog() {
  const user = userEvent.setup();
  renderPage();
  const direct = screen.queryByRole("button", { name: /^cancel job$/i });
  if (direct) {
    await user.click(direct);
  } else {
    await user.click(screen.getByRole("button", { name: /more/i }));
    await user.click(await screen.findByRole("menuitem", { name: /cancel job/i }));
  }
  const dialog = await screen.findByRole("dialog");
  return { user, dialog };
}

beforeEach(() => {
  toast.mockClear();
  cancelMutate.mockClear();
  cancelResult = {
    success: true,
    message: "Job cancelled and quantities restored to order",
    programmes: { warping: "cancelled", covering: "cancelled" },
    warpingBatches: [],
  };
});

describe("cancelling a job", () => {
  it("says beforehand that the warping and covering go with it", async () => {
    const { dialog } = await openCancelDialog();
    expect(within(dialog).getByText(/warping and covering are\s+cancelled with it/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("reports a plain cancellation as before", async () => {
    const { user, dialog } = await openCancelDialog();
    await user.click(within(dialog).getByRole("button", { name: /^cancel job$/i }));
    expect(cancelMutate).toHaveBeenCalledWith({ jobId: "j1", reason: undefined }, expect.anything());
    expect(toast).toHaveBeenCalledWith("Job cancelled", "success");
  });

  it("passes on what to do when a warping was left open with yarn issued", async () => {
    cancelResult = {
      success: true,
      message:
        "Job cancelled and quantities restored to order. Its warping is still open: yarn has been issued on WB-0042 — cancel that batch to put the yarn back, then cancel the warping.",
      programmes: { warping: "left_open", covering: "cancelled" },
      warpingBatches: ["WB-0042"],
    };
    const { user, dialog } = await openCancelDialog();
    await user.click(within(dialog).getByRole("button", { name: /^cancel job$/i }));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/WB-0042.*cancel that batch/), "info");
    expect(toast).not.toHaveBeenCalledWith("Job cancelled", "success");
  });
});
