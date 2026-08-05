import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OutsourcingPanel } from "./OutsourcingPanel";
import { outsourcingBlockers } from "./outsourcing";

// The vendor record IS an outsourced job's production record, and the
// server refuses the move to finishing until it reconciles. The panel has
// to show what is still outstanding WHILE it is being filled — finding
// out only when the status change is rejected is the bad version.

// vi.mock factories are hoisted above const declarations, so the spies
// have to be hoisted with them.
const { put, toast } = vi.hoisted(() => ({
  put: vi.fn().mockResolvedValue({ success: true }),
  toast: vi.fn(),
}));
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: vi.fn(), post: vi.fn(), put, patch: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const COMPLETE = {
  qtySentMeters: 1000,
  qtyReceivedMeters: 940,
  efficiencyPct: 94,
  actualReturnDate: "2026-05-20",
  notes: "Returned in two bundles; 60 m short.",
};

function renderPanel(record?: Parameters<typeof OutsourcingPanel>[0]["record"]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <OutsourcingPanel jobId="j1" vendor="Sunrise Weaving" record={record} />
    </QueryClientProvider>
  );
}

beforeEach(() => { put.mockClear(); toast.mockClear(); });

describe("OutsourcingPanel", () => {
  it("names the vendor and says why there are no shifts", () => {
    renderPanel(null);
    expect(screen.getByText(/Outsourced — Sunrise Weaving/)).toBeInTheDocument();
    expect(screen.getByText(/no shifts run against it here/i)).toBeInTheDocument();
  });

  it("lists what is still needed before finishing on a blank record", () => {
    renderPanel(null);
    const still = screen.getByText(/Still needed before finishing/i);
    for (const f of [/Quantity sent/i, /Quantity received/i, /Efficiency/i, /Actual return date/i, /Notes/i]) {
      expect(still.textContent).toMatch(f);
    }
  });

  it("reports a complete record as ready to move", () => {
    renderPanel(COMPLETE);
    expect(screen.getByText(/Complete — this job can move to finishing/i)).toBeInTheDocument();
  });

  // The outstanding list is computed from what is on screen, so it
  // shrinks as the planner types rather than only after a save.
  it("drops a requirement from the list as soon as it is typed", async () => {
    const user = userEvent.setup();
    renderPanel(null);
    expect(screen.getByText(/Still needed/i).textContent).toMatch(/Efficiency/i);

    await user.type(screen.getByLabelText(/Efficiency/i), "94");
    expect(screen.getByText(/Still needed/i).textContent).not.toMatch(/Efficiency \(%\) is required/i);
  });

  it("saves a partly-filled record rather than refusing it", async () => {
    const user = userEvent.setup();
    renderPanel(null);
    await user.type(screen.getByLabelText(/Quantity sent/i), "1000");
    await user.click(screen.getByRole("button", { name: /save vendor record/i }));

    expect(put).toHaveBeenCalledTimes(1);
    const [url, body] = put.mock.calls[0];
    expect(url).toBe("/job/j1/outsourcing");
    expect((body as { qtySentMeters: number }).qtySentMeters).toBe(1000);
  });

  it("sends blank numeric fields as null, not NaN", async () => {
    const user = userEvent.setup();
    renderPanel(null);
    await user.click(screen.getByRole("button", { name: /save vendor record/i }));

    const [, body] = put.mock.calls[0];
    const b = body as Record<string, unknown>;
    expect(b.qtySentMeters).toBeNull();
    expect(b.ratePerMeter).toBeNull();
  });

  // A gap between the entered yield and what sent/received imply is the
  // thing worth taking back to the vendor, so it must not be buried.
  it("calls out a disagreement between entered and implied efficiency", () => {
    renderPanel({
      ...COMPLETE, efficiencyPct: 98,
      derived: { shortfallMeters: 60, derivedEfficiencyPct: 94, efficiencyVariancePct: 4, jobWorkCost: null, leadTimeDays: null },
    });
    expect(screen.getByText(/4% above what the sent\/received figures imply/i)).toBeInTheDocument();
  });

  it("shows the derived figures the planner reads rather than types", () => {
    renderPanel({
      ...COMPLETE,
      derived: { shortfallMeters: 60, derivedEfficiencyPct: 94, efficiencyVariancePct: 0, jobWorkCost: 11280, leadTimeDays: 14 },
    });
    // Assert on the labelled figure, not a bare number — "60 m" also
    // appears inside the notes.
    expect(screen.getByText(/Shortfall:/).textContent).toMatch(/60 m/);
    expect(screen.getByText(/Vendor lead time:/).textContent).toMatch(/14 d/);
    expect(screen.getByText(/Job-work cost:/).textContent).toMatch(/11,280/);
  });
});

// The panel and the server must agree on "complete", or the form says
// ready and the status change is refused.
describe("outsourcingBlockers mirrors the server rule", () => {
  it("passes a complete record", () => {
    expect(outsourcingBlockers(COMPLETE)).toEqual([]);
  });

  it.each([
    ["zero sent", { ...COMPLETE, qtySentMeters: 0 }, /greater than 0/i],
    ["efficiency over 100", { ...COMPLETE, efficiencyPct: 140 }, /between 0 and 100/i],
    ["negative received", { ...COMPLETE, qtyReceivedMeters: -5 }, /cannot be negative/i],
    ["a one-word note", { ...COMPLETE, notes: "ok" }, /at least 3 characters/i],
  ])("rejects %s", (_l, rec, expected) => {
    expect(outsourcingBlockers(rec).join("; ")).toMatch(expected);
  });
});
