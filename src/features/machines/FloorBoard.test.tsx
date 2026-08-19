import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FloorBoard } from "./FloorBoard";
import { ServiceAnalyticsPanel } from "./ServiceAnalyticsPanel";
import type { Machine, ServiceAnalytics } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR, AND WHAT THE SERVICE PANEL IS ALLOWED TO SAY
//
//  Two things are being held here, and the second matters more.
//
//  The floor board must answer "what is running" without anybody
//  counting rows, and must not carry a status in colour alone — this
//  is a screen scanned in a hurry, sometimes by somebody who cannot
//  tell the green tile from the amber one.
//
//  The service panel points at named people's work. So the tests are
//  mostly about restraint: it must print the innocent explanation
//  beside every finding, must never use the word fraud, and must say
//  "not enough history" rather than "nothing wrong" when it has too
//  little to go on. Those are the properties that keep a statistic
//  from reading as an accusation.
// ══════════════════════════════════════════════════════════════════

const machine = (over: Partial<Machine> = {}): Machine => ({
  _id: `id-${over.ID ?? Math.random()}`,
  ID: "LOOM-1",
  manufacturer: "Comez",
  NoOfHead: 8,
  NoOfHooks: 24,
  status: "free",
  ...over,
});

/** The machine ID off each tile, in the order they are drawn. */
const tileIds = () =>
  screen.getAllByRole("link").map((a) => a.querySelector("span")?.textContent);

const board = (machines: Machine[]) =>
  render(<MemoryRouter><FloorBoard machines={machines} /></MemoryRouter>);

describe("the floor board", () => {
  it("says how many looms are running without anybody counting", () => {
    board([
      machine({ ID: "L1", status: "running" }),
      machine({ ID: "L2", status: "running" }),
      machine({ ID: "L3", status: "free" }),
      machine({ ID: "L4", status: "maintenance" }),
    ]);

    // Scoped to the summary line: "2" also appears as a group count,
    // and a bare getByText would match either.
    const summary = screen.getByText(/looms running/i);
    expect(summary).toHaveTextContent("2 of 4 looms running");
    expect(summary).toHaveTextContent("(50%)");
  });

  it("groups the looms by what they are doing", () => {
    board([
      machine({ ID: "L1", status: "running" }),
      machine({ ID: "L2", status: "maintenance" }),
      machine({ ID: "L3", status: "free" }),
    ]);

    // By role: "Running" is also the word on every running tile, which
    // is the point of the colour-blindness test below.
    expect(screen.getByRole("heading", { name: "Running" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "In maintenance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Idle" })).toBeInTheDocument();
  });

  it("leaves out a group with nothing in it", () => {
    // An empty "In maintenance" heading is a line of noise on a screen
    // meant to be scanned.
    board([machine({ ID: "L1", status: "running" })]);
    expect(screen.queryByRole("heading", { name: "In maintenance" }))
      .not.toBeInTheDocument();
  });

  it("never carries a status in colour alone", () => {
    // A green tile and an amber tile are the same tile to a
    // colour-blind reader.
    board([machine({ ID: "L1", status: "running" })]);
    const tile = screen.getByRole("link", { name: /L1/ });
    expect(within(tile).getByText("Running")).toBeInTheDocument();
  });

  it("shows the job number on a running loom", () => {
    // The one extra fact worth the space — it is what somebody is
    // looking for when they scan.
    board([machine({
      ID: "L1", status: "running",
      orderRunning: { _id: "j1", jobOrderNo: 42 },
    })]);
    expect(screen.getByText("J-42")).toBeInTheDocument();
  });

  it("shows the head count on an idle one instead", () => {
    board([machine({ ID: "L1", status: "free", NoOfHead: 12 })]);
    expect(screen.getByText("12 heads")).toBeInTheDocument();
  });

  it("describes the mix for a reader who cannot see the bar", () => {
    board([
      machine({ ID: "L1", status: "running" }),
      machine({ ID: "L2", status: "maintenance" }),
      machine({ ID: "L3", status: "free" }),
    ]);
    expect(screen.getByRole("img", {
      name: /1 running, 1 in maintenance, 1 idle/i,
    })).toBeInTheDocument();
  });

  it("puts the tiles in machine order, not server order", () => {
    // A grid gives no other clue where to look for LOOM-7. Unsorted
    // tiles are worse than an unsorted table, not better.
    board([
      machine({ ID: "LOOM-10", status: "running" }),
      machine({ ID: "LOOM-2", status: "running" }),
      machine({ ID: "LOOM-1", status: "running" }),
    ]);

    // The tile's text runs "LOOM-1Running8 heads", so compare the
    // leading ID rather than trying to anchor inside it.
    expect(tileIds()).toEqual(["LOOM-1", "LOOM-2", "LOOM-10"]);
  });

  it("orders a bare numeric ID as a number", () => {
    board([
      machine({ ID: "10", status: "free" }),
      machine({ ID: "2", status: "free" }),
      machine({ ID: "1", status: "free" }),
    ]);

    expect(tileIds()).toEqual(["1", "2", "10"]);
  });

  it("orders each group on its own", () => {
    // Sorting the whole floor once and then splitting would work too,
    // but only by accident — this pins that every group is ordered.
    board([
      machine({ ID: "LOOM-10", status: "maintenance" }),
      machine({ ID: "LOOM-2", status: "maintenance" }),
      machine({ ID: "LOOM-20", status: "running" }),
      machine({ ID: "LOOM-3", status: "running" }),
    ]);

    // Running group first, in order; then maintenance, in order.
    expect(tileIds()).toEqual(["LOOM-3", "LOOM-20", "LOOM-2", "LOOM-10"]);
  });

  it("does not divide by zero on an empty floor", () => {
    board([]);
    expect(screen.getByText(/looms running/i)).toBeInTheDocument();
  });
});

// ── The service panel ─────────────────────────────────────────────

const analytics = vi.fn();
vi.mock("./hooks", () => ({
  useServiceAnalytics: () => analytics(),
  useMachineMutations: () => ({
    dismissFinding: { mutateAsync: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const result = (data: Partial<ServiceAnalytics>) => ({
  data: {
    days: 365,
    spend: {
      windowDays: 365, series: [], total: 0, services: 0,
      typicalMonth: 0, meanMonth: 0, byType: [], byTechnician: [],
    },
    anomalies: { ready: true, windowDays: 365, services: 40, findings: [] },
    costliest: [],
    ...data,
  },
  isLoading: false, isError: false, error: null, refetch: vi.fn(),
});

const panel = () =>
  render(<MemoryRouter><ServiceAnalyticsPanel /></MemoryRouter>);

describe("what the service panel says", () => {
  it("distinguishes too little history from nothing wrong", () => {
    // These are different statements and only one is honest from a
    // handful of service logs.
    analytics.mockReturnValue(result({
      anomalies: {
        ready: false, reason: "Only 3 services on record in this window.",
        windowDays: 365, services: 3, findings: [],
      },
    }));
    panel();

    expect(screen.getByText(/not enough service history/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing stands out/i)).not.toBeInTheDocument();
  });

  it("says nothing stands out only when it has actually looked", () => {
    analytics.mockReturnValue(result({}));
    panel();
    expect(screen.getByText(/nothing stands out/i)).toBeInTheDocument();
    expect(screen.getByText(/40 services checked/i)).toBeInTheDocument();
  });

  it("prints the innocent reading beside a finding", () => {
    // The property that keeps a statistic from reading as an
    // accusation. It is never collapsed and never optional.
    analytics.mockReturnValue(result({
      anomalies: {
        ready: true, windowDays: 365, services: 40,
        findings: [{
          kind: "technician-cost", subject: "Rajan", severity: 0.8,
          title: "Rajan's jobs cost more than other technicians'",
          detail: "Typically ₹8,000 a job against ₹2,000.",
          innocent: "The technician trusted with the difficult machines will always bill more.",
          evidence: [{ machineID: "LOOM-01", cost: 8000 }],
        }],
      },
    }));
    panel();

    expect(screen.getByText(/trusted with the difficult machines/i)).toBeInTheDocument();
  });

  it("never uses the word fraud", () => {
    analytics.mockReturnValue(result({
      anomalies: {
        ready: true, windowDays: 365, services: 40,
        findings: [{
          kind: "duplicate-bill-no", subject: "v|inv-100", severity: 0.9,
          title: "Bill INV-100 is filed 2 times",
          detail: "The same bill number appears against 2 machines.",
          innocent: "Usually the same document uploaded twice.",
          evidence: [{ machineID: "LOOM-01", billNo: "INV-100" }],
        }],
      },
    }));
    panel();

    expect(document.body.textContent).not.toMatch(/fraud|theft|steal/i);
  });

  it("calls the section what it is — places to look", () => {
    analytics.mockReturnValue(result({}));
    panel();
    expect(screen.getByText(/patterns worth checking/i)).toBeInTheDocument();
    expect(screen.getByText(/list of places to look/i)).toBeInTheDocument();
  });

  it("shows the typical month and the mean side by side", () => {
    // Where they diverge, one big month is carrying the average, and
    // seeing both is the only way to notice.
    analytics.mockReturnValue(result({
      spend: {
        windowDays: 365,
        series: [{ month: "2026-01", total: 0, labour: 0, parts: 0, services: 0 }],
        total: 120000, services: 1, typicalMonth: 0, meanMonth: 10000,
        byType: [], byTechnician: [],
      },
    }));
    panel();

    expect(screen.getByText("₹0")).toBeInTheDocument();
    expect(screen.getByText(/mean ₹10,000/)).toBeInTheDocument();
  });
});
