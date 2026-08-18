import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemesPanel } from "./ThemesPanel";
import type { ThemesReport } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE PANEL THAT HAS TO BE COMFORTABLE SAYING NOTHING
//
//  Below the volume floor the backend returns `themes: null` and a
//  sentence explaining why. The single most important thing this panel
//  does is print that sentence instead of an empty list — "we looked
//  and found no themes" and "there is not enough here to look" are
//  different claims, and rendering the first when the second is true is
//  how nine complaints become a process change.
//
//  The counts are the other half: exact from day one, and shown even
//  when there are no themes at all.
// ══════════════════════════════════════════════════════════════════

const themes = vi.fn();
vi.mock("./api", () => ({
  complaintService: {
    themes: async (d: number) => ({ success: true, data: await themes(d) }),
  },
}));

const report = (over: Partial<ThemesReport> = {}): ThemesReport => ({
  windowDays: 365,
  total: 40,
  byCategory: { shade: 20, strength: 0, width: 12, finish: 0, quantity: 0, packing: 8, delivery: 0, other: 0 },
  byStatus: { Open: 30, Closed: 10 },
  themes: null,
  ungrouped: null,
  aiGenerated: false,
  ...over,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemesPanel />
    </QueryClientProvider>
  );
}

beforeEach(() => { themes.mockReset(); });

describe("ThemesPanel", () => {
  it("prints the reason instead of an empty list below the floor", async () => {
    themes.mockResolvedValue(report({
      total: 9,
      belowThreshold: true,
      note: "9 complaint(s) in the last 365 days. Themes are not produced below 25.",
    }));

    renderPanel();
    expect(await screen.findByText(/themes are not produced below 25/i)).toBeInTheDocument();
  });

  it("still shows exact category counts when there are no themes", async () => {
    // The day-one product. It does not depend on the model and must not
    // disappear along with the themes.
    themes.mockResolvedValue(report({ total: 9, belowThreshold: true, note: "not enough" }));

    renderPanel();
    expect(await screen.findByText("shade")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("shows a category with nothing in it as zero rather than omitting it", async () => {
    // A reader scanning for "strength" has to be able to tell "none"
    // from "the row is missing".
    themes.mockResolvedValue(report({ total: 9, belowThreshold: true, note: "x" }));

    renderPanel();
    expect(await screen.findByText("strength")).toBeInTheDocument();
  });

  it("renders themes with their count and share when there is enough data", async () => {
    themes.mockResolvedValue(report({
      total: 40, sampled: 40, aiGenerated: true, ungrouped: 10,
      themes: [
        { label: "shade band across the beam", count: 18, sharePct: 45, complaintIds: [], examples: ["Shade drifts"] },
        { label: "narrower than ordered", count: 12, sharePct: 30, complaintIds: [], examples: [] },
      ],
    }));

    renderPanel();
    expect(await screen.findByText("shade band across the beam")).toBeInTheDocument();
    expect(screen.getByText("18 · 45%")).toBeInTheDocument();
  });

  it("reports how many complaints fell into no theme", async () => {
    // A grouping covering a quarter of the complaints is a weak summary
    // and the reader cannot tell without this number.
    themes.mockResolvedValue(report({
      total: 40, sampled: 40, aiGenerated: true, ungrouped: 30,
      themes: [{ label: "shade band", count: 10, sharePct: 25, complaintIds: [], examples: [] }],
    }));

    renderPanel();
    expect(await screen.findByText(/30 complaints fell into no theme/i)).toBeInTheDocument();
  });

  it("says the themes were machine-grouped, and that the counts were not", async () => {
    themes.mockResolvedValue(report({
      total: 40, sampled: 40, aiGenerated: true, ungrouped: 0,
      themes: [{ label: "shade band", count: 40, sharePct: 100, complaintIds: [], examples: [] }],
    }));

    renderPanel();
    expect(await screen.findByText(/every count above is worked out from that assignment, not stated by it/i))
      .toBeInTheDocument();
  });

  it("does not claim machine grouping when none happened", async () => {
    themes.mockResolvedValue(report({ total: 9, belowThreshold: true, note: "not enough" }));

    renderPanel();
    await screen.findByText(/not enough/i);
    expect(screen.queryByText(/worked out from that assignment/i)).not.toBeInTheDocument();
  });

  it("hides the category chart entirely when nothing has been filed", async () => {
    themes.mockResolvedValue(report({
      total: 0,
      byCategory: { shade: 0, strength: 0, width: 0, finish: 0, quantity: 0, packing: 0, delivery: 0, other: 0 },
      note: "No complaints recorded in this window.",
    }));

    renderPanel();
    expect(await screen.findByText(/no complaints recorded/i)).toBeInTheDocument();
    expect(screen.queryByText("By category")).not.toBeInTheDocument();
  });
});
