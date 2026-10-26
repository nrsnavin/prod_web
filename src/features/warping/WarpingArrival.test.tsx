import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WarpingDetailPage } from "./WarpingDetailPage";

// Arriving at a warping from its job: "?plan=create" opens the plan
// form when there is no plan yet, and "#plan" goes to the plan.

let planExists = false;
let status = "open";
vi.mock("./hooks", () => ({
  useWarping: () => ({
    data: {
      warping: { _id: "w1", status, job: { _id: "j1", jobOrderNo: 12 }, elasticOrdered: [] },
      yarnLots: { planned: [], lots: [], sections: { total: 0, withLot: 0, open: 0 }, openBeamNos: [] },
    },
    isLoading: false,
    isError: false,
  }),
  useWarpingPlan: () => ({ isLoading: false, data: planExists ? { exists: true, plan: { _id: "p1", beams: [] } } : { exists: false } }),
  useWarpingMutations: () => ({
    start: { mutate: vi.fn(), isPending: false },
    complete: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
    deletePlan: { mutate: vi.fn(), isPending: false },
    createPlan: { mutate: vi.fn(), isPending: false },
  }),
  useWarpingBatches: () => ({ data: [], isLoading: false }),
  useBatchMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    issue: { mutate: vi.fn(), isPending: false },
    complete: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("./WarpingPlanForm", () => ({ WarpingPlanForm: () => <p>the plan form</p> }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/features/materials/hooks", () => ({ useYarnLots: () => ({ data: [], isLoading: false }) }));

const renderAt = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/warping/:id" element={<WarpingDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  planExists = false;
  status = "open";
  Element.prototype.scrollIntoView = vi.fn();
});

describe("arriving at a warping from its job", () => {
  it("opens the plan form when asked to create a plan and there is none", async () => {
    renderAt("/warping/w1?plan=create#plan");
    expect(await screen.findByText("the plan form")).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("does not open it when a plan already exists, and goes to the plan", () => {
    planExists = true;
    renderAt("/warping/w1?plan=create#plan");
    expect(screen.queryByText("the plan form")).not.toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("does nothing special when opened plainly", () => {
    renderAt("/warping/w1");
    expect(screen.queryByText("the plan form")).not.toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("does not open the form on a warping already started", () => {
    status = "in_progress";
    renderAt("/warping/w1?plan=create");
    expect(screen.queryByText("the plan form")).not.toBeInTheDocument();
  });
});
