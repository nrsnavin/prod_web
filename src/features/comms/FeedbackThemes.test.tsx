import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedbackThemes } from "./FeedbackThemes";

const get = vi.fn();
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...a) } }));
const wrap = () => render(<QueryClientProvider client={new QueryClient()}><FeedbackThemes /></QueryClientProvider>);

describe("FeedbackThemes", () => {
  it("shows the themes with their counts", async () => {
    get.mockResolvedValue({ data: { windowDays: 90, total: 13, byCategory: { facilities: 10, payroll: 2, safety: 1 }, byType: { complaint: 9, suggestion: 4 }, unanswered: 5, daysToAnswer: 2.5,
      themes: [{ label: "Heat and no fans near loom row 3", count: 6, sharePct: 46.2, complaints: 6, open: 4, examples: ["Too hot near loom row 3"] }], ungrouped: 7 } });
    wrap();
    expect(await screen.findByText("Heat and no fans near loom row 3")).toBeInTheDocument();
    expect(screen.getByText(/6 notes \(46.2%\), 4 still open/)).toBeInTheDocument();
    expect(screen.getByText(/7 notes fit no theme/)).toBeInTheDocument();
  });

  it("says why there are no themes yet", async () => {
    get.mockResolvedValue({ data: { windowDays: 90, total: 3, byCategory: { payroll: 3 }, byType: { complaint: 3, suggestion: 0 }, unanswered: 3, daysToAnswer: null, themes: null, ungrouped: null, note: "3 note(s) in the last 90 days. Themes start at 12." } });
    wrap();
    expect(await screen.findByText(/Themes start at 12/)).toBeInTheDocument();
  });
});
