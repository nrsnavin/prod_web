import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WarpingDetailPage } from "./WarpingDetailPage";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  COMPLETING A WARPING WHOSE YARN IS STILL ON THE RACK
//
//  The server refuses with 409 WARPING_YARN_NOT_ISSUED. That refusal
//  names something the operator can go and do — issue the batch — so
//  it has to stay on screen, not flash past in a toast that is gone by
//  the time they look up.
// ══════════════════════════════════════════════════════════════════

const completeMutate = vi.fn();
const toast = vi.fn();

vi.mock("./hooks", () => ({
  useWarping: () => ({
    data: {
      warping: {
        _id: "w1",
        status: "in_progress",
        job: { _id: "j1", jobOrderNo: 12 },
        elasticOrdered: [],
      },
      yarnLots: { planned: [], lots: [], sections: { total: 0, withLot: 0, open: 0 }, openBeamNos: [] },
    },
    isLoading: false,
    isError: false,
  }),
  useWarpingPlan: () => ({ data: { exists: true, plan: { _id: "p1", beams: [] } } }),
  useWarpingMutations: () => ({
    start: { mutate: vi.fn(), isPending: false },
    complete: { mutate: completeMutate, isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
    deletePlan: { mutate: vi.fn(), isPending: false },
  }),
  useWarpingBatches: () => ({ data: [], isLoading: false }),
  useBatchMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    issue: { mutate: vi.fn(), isPending: false },
    completeBatch: { mutate: vi.fn(), isPending: false },
    cancelBatch: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/features/materials/hooks", () => ({
  useYarnLots: () => ({ data: [], isLoading: false }),
}));

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <WarpingDetailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

/**
 * Make the complete mutation answer the way the server does.
 *
 * ApiError is (message, status, cause, code) — the code is the FOURTH
 * argument, not the third. Passing it third puts it in `cause`, where
 * nothing reads it, and the test then fails against working code.
 */
const refuseWith = (code: string, message: string) =>
  completeMutate.mockImplementation((_vars, opts) =>
    opts?.onError?.(new ApiError(message, 409, undefined, code))
  );

beforeEach(() => {
  completeMutate.mockReset();
  toast.mockClear();
});

describe("completing while the yarn is still on the rack", () => {
  it("holds the refusal on screen rather than toasting it away", async () => {
    const user = userEvent.setup();
    refuseWith(
      "WARPING_YARN_NOT_ISSUED",
      "Warping cannot be completed yet — 1 warping batch created but not issued."
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: /^complete$/i }));

    expect(screen.getByText(/still on the rack/i)).toBeInTheDocument();
    expect(screen.getByText(/created but not issued/i)).toBeInTheDocument();
    // Not a toast — a toast is gone by the time they look up.
    expect(toast).not.toHaveBeenCalled();
  });

  it("says why the rule exists, not only that it fired", async () => {
    const user = userEvent.setup();
    refuseWith("WARPING_YARN_NOT_ISSUED", "not issued");
    renderPage();

    await user.click(screen.getByRole("button", { name: /^complete$/i }));
    expect(screen.getByText(/moves the lot balances/i)).toBeInTheDocument();
  });

  it("still toasts an unrelated failure", async () => {
    // Only the one refusal is actionable on this screen; everything else
    // should behave as it did.
    const user = userEvent.setup();
    completeMutate.mockImplementation((_vars, opts) =>
      opts?.onError?.(new ApiError("Warping is not in progress", 400))
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: /^complete$/i }));

    expect(toast).toHaveBeenCalledWith("Warping is not in progress", "error");
    expect(screen.queryByText(/still on the rack/i)).not.toBeInTheDocument();
  });

  it("sends no force on the ordinary attempt", async () => {
    const user = userEvent.setup();
    refuseWith("WARPING_YARN_NOT_ISSUED", "not issued");
    renderPage();

    await user.click(screen.getByRole("button", { name: /^complete$/i }));
    expect(completeMutate.mock.calls[0][0]).toEqual({ id: "w1", forceReason: undefined });
  });
});

describe("completing anyway", () => {
  it("asks for a reason and sends it", async () => {
    const user = userEvent.setup();
    refuseWith("WARPING_YARN_NOT_ISSUED", "not issued");
    renderPage();

    await user.click(screen.getByRole("button", { name: /^complete$/i }));
    await user.click(screen.getByRole("button", { name: /complete anyway…/i }));

    const box = screen.getByRole("textbox");
    await user.type(box, "beams already off the machine");
    await user.click(screen.getByRole("button", { name: /^complete anyway$/i }));

    expect(completeMutate.mock.calls[1][0]).toMatchObject({
      id: "w1",
      forceReason: "beams already off the machine",
    });
  });

  it("will not send a reason the server would refuse", async () => {
    // The route requires 5 characters. A dialog that accepts 3 sends the
    // user round a trip to be told something the form already knew.
    const user = userEvent.setup();
    refuseWith("WARPING_YARN_NOT_ISSUED", "not issued");
    renderPage();

    await user.click(screen.getByRole("button", { name: /^complete$/i }));
    await user.click(screen.getByRole("button", { name: /complete anyway…/i }));

    await user.type(screen.getByRole("textbox"), "abc");
    await user.click(screen.getByRole("button", { name: /^complete anyway$/i }));

    // Only the first, unforced attempt was ever sent.
    expect(completeMutate).toHaveBeenCalledTimes(1);
  });
});
