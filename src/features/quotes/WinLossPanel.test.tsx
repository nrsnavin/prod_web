import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WinLossPanel } from "./WinLossPanel";
import type { QuoteWinLoss } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A PANEL THAT SITS NEXT TO A PRICE
//
//  Everything shown here is read by somebody about to name a number to
//  a customer, which makes overstatement the expensive failure — not a
//  crash. So the tests are about what it refuses to claim:
//
//    • a band nobody has quoted in shows "no quotes", never 0%
//    • observed history is labelled as history, not as a prediction
//    • a thin band says so
//    • and nothing here writes anything
// ══════════════════════════════════════════════════════════════════

const winLoss = vi.fn();
vi.mock("./api", () => ({
  quoteService: { winLoss: (p: unknown) => winLoss(p) },
}));

const band = (over: Partial<QuoteWinLoss["bands"][number]> = {}) => ({
  band: "10–20%", minMarginPct: 10, maxMarginPct: 20,
  quotes: 8, wins: 6, winRatePct: 75, thin: false, ...over,
});

const data = (over: Partial<QuoteWinLoss> = {}): QuoteWinLoss => ({
  success: true,
  quotes: 40, wins: 24, losses: 16,
  lossBreakdown: { declined: 11, expired: 5 },
  baselineWinRatePct: 60,
  windowFrom: null,
  filters: { customerId: null, productName: null },
  estimator: "empirical",
  bands: [band()],
  curve: [],
  ...over,
});

const curve = Array.from({ length: 13 }, (_, i) => ({
  marginPct: i * 5,
  winProbabilityPct: Math.max(5, 95 - i * 7),
  expectedMarginPoints: Math.round((Math.max(5, 95 - i * 7) / 100) * i * 5 * 10) / 10,
}));

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <WinLossPanel />
    </QueryClientProvider>
  );
}

beforeEach(() => winLoss.mockReset());

describe("WinLossPanel", () => {
  it("leads with the plant win rate and the counts behind it", async () => {
    winLoss.mockResolvedValue(data());
    renderPanel();

    expect(await screen.findByText("60%")).toBeInTheDocument();
    expect(screen.getByText(/24 won · 16 lost/)).toBeInTheDocument();
  });

  it("keeps declined and expired apart", async () => {
    // A decline is the customer saying no to a price. An expiry may be
    // a quote nobody chased. Averaging them hides which problem you have.
    winLoss.mockResolvedValue(data());
    renderPanel();
    expect(await screen.findByText(/11 declined, 5 expired/)).toBeInTheDocument();
  });

  it("labels observed history as history, not as a prediction", async () => {
    winLoss.mockResolvedValue(data({
      estimator: "empirical",
      note: "12 decided quotes — too few to fit a curve. The bands below are the observed history, not a prediction.",
    }));
    renderPanel();

    expect(await screen.findByText("observed history")).toBeInTheDocument();
    expect(screen.getByText(/not a prediction/i)).toBeInTheDocument();
  });

  it("shows an empty band as 'no quotes' rather than a 0% win rate", async () => {
    // The misleading one. 0% reads as "we always lose at this price";
    // the truth is nobody has tried it.
    winLoss.mockResolvedValue(data({
      bands: [band({ band: "30–45%", quotes: 0, wins: 0, winRatePct: null })],
    }));
    renderPanel();

    expect(await screen.findByText("no quotes")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("flags a band with too few quotes to mean anything", async () => {
    winLoss.mockResolvedValue(data({
      bands: [band({ quotes: 1, wins: 1, winRatePct: 100, thin: true })],
    }));
    renderPanel();
    expect(await screen.findByText("thin")).toBeInTheDocument();
  });

  it("draws the curve only when one was fitted, and names the best margin", async () => {
    winLoss.mockResolvedValue(data({
      estimator: "logistic", curve, bestExpectedMarginPct: 30,
    }));
    renderPanel();

    expect(await screen.findByText("fitted curve")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /win probability/i })).toBeInTheDocument();
    expect(screen.getByText(/Best expected return sits around/)).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    // And says why the peak is not the cheapest price, which is the
    // part somebody has to understand before acting on it.
    expect(screen.getByText(/wins most often and earns least/i)).toBeInTheDocument();
  });

  it("does not draw a curve for observed history", async () => {
    winLoss.mockResolvedValue(data({ estimator: "empirical", curve: [] }));
    renderPanel();
    await screen.findByText("observed history");
    expect(screen.queryByRole("img", { name: /win probability/i })).not.toBeInTheDocument();
  });

  it("explains an empty history instead of showing zeros", async () => {
    winLoss.mockResolvedValue(data({
      quotes: 0, wins: 0, losses: 0, baselineWinRatePct: null,
      lossBreakdown: { declined: 0, expired: 0 }, estimator: "none", bands: [],
    }));
    renderPanel();

    expect(await screen.findByText(/No quotes have been accepted or declined/i)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("asks the server for a narrower window when one is chosen", async () => {
    winLoss.mockResolvedValue(data());
    renderPanel();
    await screen.findByText("60%");
    expect(winLoss).toHaveBeenCalledWith({ days: undefined, customerId: undefined });

    await userEvent.click(screen.getByRole("button", { name: "6 months" }));
    expect(winLoss).toHaveBeenCalledWith({ days: 180, customerId: undefined });
  });

  it("says plainly that it does not set prices", async () => {
    // The panel sits beside a pricing form. Somebody will assume it is
    // an input to it unless told otherwise.
    winLoss.mockResolvedValue(data());
    renderPanel();
    expect(await screen.findByText(/does not set a price/i)).toBeInTheDocument();
  });
});
