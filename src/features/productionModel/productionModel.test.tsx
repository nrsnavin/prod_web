import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExpectedOutput } from "./ExpectedOutput";
import { ProductionModelCard } from "./ProductionModelCard";
import { cleanRunTime, hoursMinutes, metres } from "./api";
import type { MachineExpectation, Prediction, ShiftExpectation } from "./api";

// ══════════════════════════════════════════════════════════════════
//  PREDICTED PRODUCTION ON SCREEN
//
//  The entry screens show what to expect beside the metres, and ask for
//  a second look only when a figure is far outside it. The machine page
//  shows the loom's learned speed, a calculator, and the model's
//  accuracy beside simpler guesses.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a) } };
});

const prediction = (over: Partial<Prediction> = {}): Prediction => ({
  perHead: 180, low: 165, high: 196, checkLow: 150, checkHigh: 215, total: 360, totalLow: 330, totalHigh: 392,
  basis: "machine", shifts: 60, minutes: 480, pick: 24, heads: 2, ...over,
});
const shiftReply = (over: Partial<ShiftExpectation> = {}): ShiftExpectation => ({
  available: true, reason: null, prediction: prediction(), runTimeFrom: "entered", pick: 24,
  machine: { code: "LOOM-02", heads: 2 }, ...over,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// A block body: a function returned from beforeEach is run as cleanup.
beforeEach(() => {
  get.mockReset();
});

describe("helpers", () => {
  it("reads a run time as typed on a phone, and nothing half-typed", () => {
    expect(cleanRunTime("7.45")).toBe("7:45");
    expect(cleanRunTime(" 07:45:12 ")).toBe("07:45:12");
    expect(cleanRunTime("7:4")).toBe("");
    expect(cleanRunTime("")).toBe("");
  });
  it("formats", () => {
    expect(hoursMinutes(465)).toBe("7:45");
    expect(metres(1234.4)).toBe("1,234 m");
    expect(metres(86.54)).toBe("86.5 m");
  });
});

describe("what to expect, on the entry screen", () => {
  it("shows the expected metres per head for the run time being typed", async () => {
    get.mockResolvedValue(shiftReply());
    wrap(<ExpectedOutput shiftId="s1" runTime="8.00" entered="" />);
    expect(await screen.findByText("180 m")).toBeInTheDocument();
    expect(screen.getByTestId("expected-output")).toHaveTextContent("Expected about 180 m per head (165 m–196 m) for 8:00 run time.");
    expect(get).toHaveBeenCalledWith("/production-model/shift/s1", { runTime: "8:00" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks for a second look at a figure far above, suggesting the machine total was typed", async () => {
    get.mockResolvedValue(shiftReply());
    wrap(<ExpectedOutput shiftId="s1" runTime="8:00" entered="360" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "360 m is far above what LOOM-02 usually makes in 8:00. Check it is per head, not the total for all 2 heads"
    );
  });

  it("and at one far below, without stopping anyone saving it", async () => {
    get.mockResolvedValue(shiftReply());
    wrap(<ExpectedOutput shiftId="s1" runTime="8:00" entered="90" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/far below .* If the loom really did stop, add a note/);
  });

  it.each(["205", "158"])("says nothing about %s m, outside the likely range but inside the usual scatter", async (entered) => {
    get.mockResolvedValue(shiftReply());
    wrap(<ExpectedOutput shiftId="s1" runTime="8:00" entered={entered} />);
    await screen.findByText("180 m");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reads the worker's own shift through their own route", async () => {
    get.mockResolvedValue(shiftReply());
    wrap(<ExpectedOutput shiftId="s1" runTime="8:00" entered="" mine />);
    await screen.findByText("180 m");
    expect(get).toHaveBeenCalledWith("/me/shifts/s1/expected", { runTime: "8:00" });
  });

  it("shows nothing without a model or a run time, so the screen is as before", async () => {
    get.mockResolvedValue(shiftReply({ available: false, reason: "Not enough", prediction: null }));
    const { container } = wrap(<ExpectedOutput shiftId="s1" runTime="8:00" entered="" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("never breaks the entry form, even outside the app's data provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<form><input aria-label="Metres" /><ExpectedOutput shiftId="s1" runTime="8:00" entered="" /></form>);
    expect(screen.getByLabelText("Metres")).toBeInTheDocument();
    expect(container.querySelector("[data-testid=expected-output]")).toBeNull();
    vi.restoreAllMocks();
  });

  it("shows nothing when the server can't answer", async () => {
    get.mockRejectedValue(new Error("down"));
    const { container } = wrap(<ExpectedOutput shiftId="s1" runTime="8:00" entered="" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

const machineReply = (over: Partial<MachineExpectation> = {}): MachineExpectation => ({
  available: true, reason: null, trainedAt: "2026-10-04T10:00:00Z",
  machine: { id: "m1", code: "LOOM-01", heads: 4 },
  elastics: [{ id: "e1", name: "E12", pick: 12, heads: 4 }],
  pick: 12, pickProblem: null,
  summary: { basis: "machine", shifts: 60, speedIndex: 1.08, scatterPct: 9, metresPerHeadHour: 60, pick: 12 },
  prediction: prediction({ perHead: 720, low: 650, high: 790, total: 2880, minutes: 720, pick: 12, heads: 4 }),
  runTimeFrom: "entered",
  evaluation: {
    trainedOn: 96, testedOn: 24, testFrom: "2026-09-01", testTo: "2026-10-01",
    methods: {
      model: { mae: 12.1, medianErrorPct: 4.2, within10Pct: 88, rangeCoveragePct: 79 },
      machineAverage: { mae: 80, medianErrorPct: 21, within10Pct: 20 },
      machinePerHour: { mae: 40, medianErrorPct: 12, within10Pct: 45 },
      plantPhysics: { mae: 30, medianErrorPct: 9.5, within10Pct: 55 },
    },
  },
  ...over,
});

describe("expected production, on the machine page", () => {
  it("describes the loom against the plant and predicts a full shift at its own pick", async () => {
    get.mockResolvedValue(machineReply());
    wrap(<ProductionModelCard machineId="m1" />);
    expect(await screen.findByTestId("expected-per-head")).toHaveTextContent(/^720 m per head$/);
    expect(screen.getByText("Learned from 60 shifts")).toBeInTheDocument();
    expect(screen.getByText(/LOOM-01 runs 8% faster than the plant's typical loom\. Its shifts usually land within ±9%/)).toBeInTheDocument();
    expect(screen.getByTestId("expected-range")).toHaveTextContent(/^likely 650 m–790 m per head · 2,880 m for the machine \(4 heads\)$/);
    expect(screen.getByTestId("running-pick")).toHaveTextContent("Pick12From the elastic record: E12 on 4 heads");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/production-model/machine/m1", { runTime: "12:00" });
  });

  it("recalculates for another run time; the pick is the elastic's own, with nothing to type", async () => {
    get.mockResolvedValue(machineReply());
    wrap(<ProductionModelCard machineId="m1" />);
    await screen.findByTestId("expected-per-head");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1); // run time only
    const runTime = screen.getByLabelText("Run time");
    await userEvent.clear(runTime);
    await userEvent.type(runTime, "6.30");
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/production-model/machine/m1", { runTime: "6:30" }));
  });

  it.each([
    ["no-elastics", /No elastic is threaded/],
    ["no-pick", /has no pick in its record/],
  ] as const)("says why there is no prediction (%s)", async (pickProblem, why) => {
    get.mockResolvedValue(machineReply({ pickProblem, pick: null, prediction: null }));
    wrap(<ProductionModelCard machineId="m1" />);
    expect(await screen.findByRole("status")).toHaveTextContent(why);
    expect(screen.queryByTestId("expected-per-head")).not.toBeInTheDocument();
  });

  it("flags elastic records that disagree on the pick", async () => {
    get.mockResolvedValue(machineReply({
      pickProblem: "mixed", pick: 16,
      elastics: [{ id: "e1", name: "E12", pick: 12, heads: 2 }, { id: "e2", name: "E24", pick: 24, heads: 2 }],
    }));
    wrap(<ProductionModelCard machineId="m1" />);
    expect(await screen.findByRole("status")).toHaveTextContent("different picks in their records (E12: 12, E24: 24)");
  });

  it("shows its accuracy beside simpler guesses", async () => {
    get.mockResolvedValue(machineReply());
    wrap(<ProductionModelCard machineId="m1" />);
    await userEvent.click(await screen.findByText("How accurate is this?"));
    expect(screen.getByText(/Trained on 96 verified shifts, then tested on the 24 after them/)).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /This model 4.2% 12.1 m 88%/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Machine's average per shift 21% 80 m 20%/ })).toBeInTheDocument();
    expect(screen.queryByText(/a simpler guess did better/)).not.toBeInTheDocument();
  });

  it("says so plainly when a simpler guess did better", async () => {
    const r = machineReply();
    r.evaluation!.methods.model.medianErrorPct = 15;
    get.mockResolvedValue(r);
    wrap(<ProductionModelCard machineId="m1" />);
    await userEvent.click(await screen.findByText("How accurate is this?"));
    expect(screen.getByText(/a simpler guess did better; treat these figures as rough/)).toBeInTheDocument();
  });

  it("says why there is no model yet", async () => {
    get.mockResolvedValue(machineReply({ available: false, reason: "Not enough verified shifts yet to learn from.", summary: null, prediction: null }));
    wrap(<ProductionModelCard machineId="m1" />);
    expect(await screen.findByText("Not enough verified shifts yet to learn from.")).toBeInTheDocument();
  });
});
