import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobDetailPage } from "./JobDetailPage";
import { ApiError } from "@/core/http/httpClient";

// JobWeavingGate.test.tsx mocks ./hooks, so it proves the page's logic
// but not the wiring underneath it: the query keys, the request paths,
// and the shape the server actually answers with. This one mocks only
// the HTTP transport, so api.ts, hooks.ts and the page all run for real.
// A gate wired to the wrong URL is a gate that does not work.

const get = vi.fn();
const post = vi.fn();

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./MachineAssignModal", () => ({ MachineAssignModal: () => null }));
vi.mock("./QcPanel", () => ({ QcPanel: () => null }));
vi.mock("./JobYarnLots", () => ({ JobYarnLots: () => null }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

const jobPayload = {
  success: true,
  data: {
    id: "j1",
    jobOrderNo: 12,
    jobNo: "J-12",
    status: "preparatory",
    customerName: "Sri Textiles",
    orderNo: 1042,
    plannedElastics: [],
    producedElastics: [],
    packedElastics: [],
    wastageElastics: [],
    shiftDetails: [],
    wastages: [],
    warping: { status: "completed" },
    covering: { status: "in_progress" },
  },
};

// Exactly what tests/api/weavingGate.integration.test.js proves the
// server returns on GET /job/:id/weaving-readiness.
const readinessPayload = {
  success: true,
  data: {
    ready: false,
    jobStatus: "preparatory",
    stages: [
      { stage: "warping", linked: true, status: "completed", done: true },
      { stage: "covering", linked: true, status: "in_progress", done: false },
    ],
    blockers: ["The covering is in progress, not completed"],
  },
};

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/jobs/j1"]}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  toast.mockClear();
  get.mockImplementation((url: string) => {
    if (url === "/job/j1") return Promise.resolve(jobPayload);
    if (url === "/job/j1/weaving-readiness") return Promise.resolve(readinessPayload);
    if (url === "/job/summary") return Promise.resolve({ success: true, summary: [] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
});

describe("the weaving gate is wired to the real endpoints", () => {
  it("asks the readiness endpoint on the path the server serves", async () => {
    renderPage();
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/job/j1/weaving-readiness")
    );
  });

  it("renders the blockers the server sent", async () => {
    renderPage();
    expect(
      await screen.findByText(/covering is in progress, not completed/i)
    ).toBeInTheDocument();
  });

  it("posts the move to update-status and opens the alert on a 409", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(
      new ApiError("Job cannot move to weaving yet — the covering is in progress", 409, null, "WEAVING_NOT_READY", {
        success: false,
        code: "WEAVING_NOT_READY",
        details: { blockers: ["The covering is in progress, not completed"] },
      })
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: /move to weaving/i }));

    expect(post).toHaveBeenCalledWith("/job/update-status", {
      jobId: "j1",
      nextStatus: "weaving",
    });
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/covering is in progress/i);
    expect(toast).not.toHaveBeenCalled();
  });

  it("does not ask about readiness once the job is past preparatory", async () => {
    get.mockImplementation((url: string) => {
      if (url === "/job/j1")
        return Promise.resolve({ ...jobPayload, data: { ...jobPayload.data, status: "weaving" } });
      if (url === "/job/summary") return Promise.resolve({ success: true, summary: [] });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
    renderPage();

    await screen.findByRole("button", { name: /move to finishing/i });
    expect(get).not.toHaveBeenCalledWith("/job/j1/weaving-readiness");
  });
});
