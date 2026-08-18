import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { LearnedWeightsPanel } from "./LearnedWeightsPanel";
import type { WeightsReport } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A PANEL ABOUT A SYSTEM THAT CHANGES ITSELF
//
//  The planner now moves its own objective. That is only acceptable if
//  the change is visible, attributable and reversible, so these tests
//  are about those three things rather than about layout.
//
//  The one that matters most: below the warm-up threshold the weights
//  are being LEARNED but are not being USED. Showing a learned figure
//  while the planner quietly ignores it would be a lie in the most
//  convincing possible format — a specific number on a screen.
// ══════════════════════════════════════════════════════════════════

const weights = vi.fn();
const reset = vi.fn();
vi.mock("./hooks", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("./hooks");
  return {
    ...actual,
    usePlannerWeights: () => weights(),
    useResetWeights: () => reset(),
  };
});

const report = (over: Partial<WeightsReport> = {}): WeightsReport => ({
  active: { late: 10, changeover: 1, balance: 0.1 },
  learned: false,
  stored: { late: 10, changeover: 1, balance: 0.1 },
  defaults: { late: 10, changeover: 1, balance: 0.1 },
  bounds: { changeover: { min: 0.1, max: 10 }, balance: { min: 0.01, max: 5 } },
  observations: 0,
  needed: 5,
  learningRate: 0.5,
  lastResetAt: null,
  lastResetBy: "",
  history: [],
  ...over,
});

function renderPanel(data: WeightsReport | undefined, isLoading = false) {
  weights.mockReturnValue({ data, isLoading });
  reset.mockReturnValue({ mutate: vi.fn(), isPending: false });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <LearnedWeightsPanel />
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => { weights.mockReset(); reset.mockReset(); });

describe("LearnedWeightsPanel", () => {
  it("says it is on the starting objective before anything is learned", () => {
    renderPanel(report());
    expect(screen.getByText(/running on the starting objective/i)).toBeInTheDocument();
  });

  it("distinguishes learning from using, during the warm-up", () => {
    // The claim this panel must never make: a number that looks live
    // while the planner is ignoring it.
    renderPanel(report({
      observations: 2,
      stored: { late: 10, changeover: 0.6, balance: 0.1 },
      active: { late: 10, changeover: 1, balance: 0.1 },
      learned: false,
    }));

    expect(screen.getByText(/2 corrections recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/5 needed before they are used/i)).toBeInTheDocument();
    expect(screen.getByText(/still running on the\s+starting numbers/i)).toBeInTheDocument();
  });

  it("says so once the learned objective is actually in force", () => {
    renderPanel(report({
      observations: 7, learned: true,
      active: { late: 10, changeover: 4, balance: 0.1 },
    }));
    expect(screen.getByText(/running on the objective it learned here/i)).toBeInTheDocument();
    expect(screen.queryByText(/needed before they are used/i)).not.toBeInTheDocument();
  });

  it("reads the weights as exchange rates against a late day", () => {
    // "0.40 late days" is a sentence somebody on the floor can disagree
    // with. "W_CHANGE = 4" is not.
    renderPanel(report({
      observations: 7, learned: true,
      active: { late: 10, changeover: 4, balance: 0.1 },
    }));
    expect(screen.getByText("0.40 late days")).toBeInTheDocument();
  });

  it("shows what a weight used to be once it has moved", () => {
    renderPanel(report({
      observations: 7, learned: true,
      active: { late: 10, changeover: 4, balance: 0.1 },
    }));
    // The default changeover cost is 1 against a lateness anchor of 10,
    // which reads as a tenth of a late day.
    expect(screen.getByText(/was 0.10 late days/i)).toBeInTheDocument();
  });

  it("does not offer a reset when there is nothing to reset", () => {
    renderPanel(report());
    expect(screen.queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();
  });

  it("offers one once corrections exist, and confirms before discarding them", async () => {
    const mutate = vi.fn();
    weights.mockReturnValue({ data: report({ observations: 6, learned: true }), isLoading: false });
    reset.mockReturnValue({ mutate, isPending: false });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <LearnedWeightsPanel />
        </ToastProvider>
      </QueryClientProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /reset/i }));
    // Not fired on the first click — the corrections are unrecoverable.
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/not recoverable/i)).toBeInTheDocument();
  });

  it("shows where each correction came from", async () => {
    renderPanel(report({
      observations: 6, learned: true,
      history: [{
        at: "2026-08-18T10:00:00Z", actor: "Navin", lines: 12,
        proposed: { late: 1, changeover: 6, balance: 2 },
        accepted: { late: 2, changeover: 2, balance: 2 },
        weights: { late: 10, changeover: 1.3, balance: 0.1 },
        note: "changeover cost up 1.000 → 1.300 (accepted plan had fewer of them)",
      }],
    }));

    await userEvent.click(screen.getByRole("button", { name: /what it learned, and when/i }));
    expect(screen.getByText(/changeover cost up/i)).toBeInTheDocument();
    expect(screen.getByText(/Navin · 12 lines/)).toBeInTheDocument();
    expect(screen.getByText(/offered 1d late \/ 6 changeovers/i)).toBeInTheDocument();
  });

  it("says plainly that rates are learned elsewhere", () => {
    // Otherwise this panel reads as the whole of the planner's learning,
    // and somebody resets it expecting the rates to go back too.
    renderPanel(report());
    expect(screen.getByText(/how fast each loom runs each/i)).toBeInTheDocument();
  });
});
