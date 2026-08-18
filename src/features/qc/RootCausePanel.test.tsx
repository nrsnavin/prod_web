import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootCausePanel } from "./RootCausePanel";
import type { RootCause, RootCauseFinding } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A PANEL THAT NAMES SOMEBODY
//
//  This prints the name of a yarn lot, a machine, a shift — or a
//  person. So the tests are about restraint, not layout:
//
//    • a finding never appears without the counts it rests on
//    • two findings the data cannot separate are shown TOGETHER, and
//      neither is blamed
//    • "nothing stands out" is displayed as the real answer it is
//    • the method is on the page, because somebody will be asked how
//      they know
// ══════════════════════════════════════════════════════════════════

const rootCause = vi.fn();
vi.mock("./api", () => ({ qcService: { rootCause: (d: number) => rootCause(d) } }));

const finding = (over: Partial<RootCauseFinding> = {}): RootCauseFinding => ({
  factor: "lot", noun: "yarn lot", key: "k1", label: "D-4471",
  checks: 12, fails: 9, failRatePct: 75, restFailRatePct: 6.7,
  lift: 11.2, chi2: 28.4, p: 0.0001, significant: true,
  headline: "yarn lot D-4471 failed 9 of 12 checks (75%) against 6.7% elsewhere — 11.2× the rate.",
  ...over,
});

const data = (over: Partial<RootCause> = {}): RootCause => ({
  success: true,
  windowDays: 90,
  since: "2026-05-20",
  totals: { checks: 42, fails: 11, failRatePct: 26.2, rejectedMeters: 440 },
  factors: { lot: [], machine: [], operator: [], shift: [] },
  findings: [],
  confounders: [],
  method: {
    minSamples: 8,
    test: "2×2 chi-square with Yates' correction",
    correction: "Benjamini–Hochberg at 10% false-discovery rate over 14 candidates",
  },
  ...over,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <RootCausePanel />
    </QueryClientProvider>
  );
}

beforeEach(() => rootCause.mockReset());

describe("RootCausePanel", () => {
  it("never prints a rate without the counts behind it", async () => {
    // A rate with no denominator is how three checks become a rejected
    // delivery and a phone call to a supplier.
    rootCause.mockResolvedValue(data({ findings: [finding()] }));
    renderPanel();

    expect(await screen.findByText("D-4471")).toBeInTheDocument();
    expect(screen.getByText(/9 of 12/)).toBeInTheDocument();
    expect(screen.getByText(/11.2× the usual rate/)).toBeInTheDocument();
  });

  it("shows two inseparable findings together and blames neither", async () => {
    // The failure that costs somebody their standing: the lot and the
    // operator rode on the same jobs, so both light up identically and
    // the data contains nothing that can tell them apart.
    rootCause.mockResolvedValue(data({
      findings: [
        finding(),
        finding({ factor: "operator", key: "e1", label: "Ravi", noun: "operator" }),
      ],
      confounders: [{
        a: { factor: "lot", label: "D-4471" },
        b: { factor: "operator", label: "Ravi" },
        sharedChecks: 12, overlapPct: 100,
        note: "yarn lot D-4471 and operator Ravi appear on the same 12 checks.",
      }],
    }));
    renderPanel();

    const lot = (await screen.findByText("D-4471")).closest("li")!;
    const op  = screen.getByText("Ravi").closest("li")!;

    // Each names the other, and both say the data does not decide.
    expect(within(lot).getByText(/operator Ravi/)).toBeInTheDocument();
    expect(within(op).getByText(/yarn lot D-4471/)).toBeInTheDocument();
    expect(within(lot).getByText(/does not say which/i)).toBeInTheDocument();
  });

  it("displays 'nothing stands out' as a real answer", async () => {
    // A report that names a culprit every week regardless is worse than
    // no report, so the empty state has to read as a finding of its own.
    rootCause.mockResolvedValue(data({
      findings: [],
      note: "11 failures across 42 checks, but nothing stands out beyond chance once the number of comparisons is accounted for.",
    }));
    renderPanel();

    expect(await screen.findByText(/nothing stands out beyond chance/i)).toBeInTheDocument();
  });

  it("puts the method on the page", async () => {
    // Somebody will be asked "how do you know?" by the supplier whose
    // lot has just been rejected. The answer has to be visible.
    rootCause.mockResolvedValue(data({ findings: [finding()] }));
    renderPanel();

    expect(await screen.findByText(/chi-square/i)).toBeInTheDocument();
    expect(screen.getByText(/Benjamini/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 checks/i)).toBeInTheDocument();
  });

  it("warns that a finding is a place to look, not a conclusion", async () => {
    rootCause.mockResolvedValue(data({ findings: [finding()] }));
    renderPanel();
    expect(await screen.findByText(/Confirm on the floor before acting/i)).toBeInTheDocument();
  });

  it("keeps thin rows out of the findings but visible in the full table", async () => {
    // A lot with three checks cannot be a finding. It is still
    // something a person may want to see, so it is one click away.
    rootCause.mockResolvedValue(data({
      findings: [],
      note: "nothing stands out",
      factors: {
        lot: [{
          factor: "lot", noun: "yarn lot", key: "t1", label: "D-TINY",
          checks: 3, fails: 3, failRatePct: 100, restFailRatePct: 5,
          lift: 20, chi2: 2.1, p: 0.14,
        }],
        machine: [], operator: [], shift: [],
      },
    }));
    renderPanel();

    // Not in the findings.
    expect(await screen.findByText(/nothing stands out/i)).toBeInTheDocument();
    expect(screen.queryByText(/3 of 3/)).not.toBeInTheDocument();

    // But reachable.
    await userEvent.click(screen.getByRole("button", { name: /All by yarn lot/i }));
    expect(screen.getByText("D-TINY")).toBeInTheDocument();
  });

  it("shows the narrative when one was written", async () => {
    rootCause.mockResolvedValue(data({
      findings: [finding()],
      narrative: "- Pull a sample from lot D-4471 before the next warping run.",
      aiGenerated: true,
    }));
    renderPanel();
    expect(await screen.findByText(/Pull a sample from lot D-4471/)).toBeInTheDocument();
  });

  it("works without a narrative — the numbers are the product", async () => {
    rootCause.mockResolvedValue(data({ findings: [finding()], narrative: null, aiGenerated: false }));
    renderPanel();
    expect(await screen.findByText("D-4471")).toBeInTheDocument();
  });

  it("asks the server for a different window when one is chosen", async () => {
    rootCause.mockResolvedValue(data());
    renderPanel();
    await screen.findByText("42");
    expect(rootCause).toHaveBeenCalledWith(90);

    await userEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(rootCause).toHaveBeenCalledWith(30);
  });
});
