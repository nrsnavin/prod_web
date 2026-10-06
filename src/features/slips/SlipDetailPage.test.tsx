import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SlipDetailPage } from "./SlipDetailPage";
import { Slip } from "./types";

// ══════════════════════════════════════════════════════════════════
//  CHECKING A SLIP AGAINST ITS PHOTO
//
//  The clear rows come ticked; a held row is not, until somebody
//  corrects it. What is sent is exactly the ticked rows with the values
//  on screen, and the version the screen was showing.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const applyMutate = vi.fn();
const discardMutate = vi.fn();
let current: Slip;

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./api", () => ({ slipService: { photo: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/jpeg" })) } }));
vi.mock("./hooks", () => ({
  isReading: (s?: { status: string } | null) => s?.status === "received" || s?.status === "reading",
  useSlip: () => ({ data: current, isLoading: false, isError: false, error: null }),
  useSlipMutations: () => ({
    apply: { mutate: applyMutate, isPending: false },
    discard: { mutate: discardMutate, isPending: false },
    setShift: { mutate: vi.fn(), isPending: false },
  }),
}));

const baseRow = {
  shiftDetail: "sd", code: null, operator: "Ravi", jobNo: "J-12", remarks: "", expected: null,
  applied: false, appliedProduction: null, notes: [] as string[],
};

function slip(over: Partial<Slip> = {}): Slip {
  return {
    id: "slip1", version: 3, confirmCode: "4821", source: "whatsapp", sentByName: "Floor Lead", from: "+91",
    caption: "", status: "ready", problem: null, format: "slip", dateKey: "2026-10-06", shift: "DAY",
    dateFrom: "caption", createdAt: "2026-10-06T10:00:00Z", readAt: null, appliedAt: null, appliedByName: "",
    counts: { rows: 3, ready: 1, check: 1, skip: 1, applied: 0, unmatched: 1 },
    rows: [
      { ...baseRow, index: 0, machineID: "M-01", machineRead: "1", production: 1200, timer: "7:30:00", confidence: 0.95, state: "ready" },
      { ...baseRow, index: 1, machineID: "M-02", machineRead: "2", production: 1080, timer: "7:20:00", confidence: 0.4, state: "check", notes: ["Handwriting unclear"] },
      { ...baseRow, index: 2, machineID: "M-03", machineRead: "3", production: 900, timer: "6:00:00", confidence: 0.9, state: "skip", notes: ["Already verified"] },
    ],
    unmatched: [{ machineRead: "M-30", production: 500, timer: "4:00:00" }],
    photos: [{ page: 0, contentType: "image/jpeg", size: 10 }],
    ...over,
  };
}

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/production-slips/slip1"]}>
        <Routes>
          <Route path="/production-slips/:id" element={<SlipDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  toast.mockClear();
  applyMutate.mockClear();
  current = slip();
});

describe("a slip waiting to be confirmed", () => {
  it("says which shift, how it knew, and who sent it", () => {
    setup();
    expect(screen.getByText(/Day shift · 6 Oct 2026 · from the message caption · sent by Floor Lead on WhatsApp/)).toBeInTheDocument();
    expect(screen.getByText("Handwriting unclear")).toBeInTheDocument();
    expect(screen.getByText("Already verified")).toBeInTheDocument();
    expect(screen.getByText("M-30")).toBeInTheDocument();
  });

  it("ticks the clear row only, and saves just that", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByLabelText("Save M-01")).toBeChecked();
    expect(screen.getByLabelText("Save M-02")).not.toBeChecked();
    expect(screen.getByLabelText("Save M-03")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Save 1 as submitted/ }));
    expect(applyMutate).toHaveBeenCalledTimes(1);
    expect(applyMutate.mock.calls[0][0]).toEqual({
      id: "slip1", version: 3,
      rows: [{ index: 0, include: true, production: 1200, timer: "7:30:00", remarks: "" }],
    });
  });

  it("correcting a held row ticks it and sends the corrected figure", async () => {
    const user = userEvent.setup();
    setup();
    const metres = screen.getByLabelText("Metres for M-02");
    await user.clear(metres);
    await user.type(metres, "1030");
    expect(screen.getByLabelText("Save M-02")).toBeChecked();

    await user.click(screen.getByRole("button", { name: /Save 2 as submitted/ }));
    const rows = applyMutate.mock.calls[0][0].rows;
    expect(rows).toEqual([
      expect.objectContaining({ index: 0, production: 1200 }),
      expect.objectContaining({ index: 1, production: "1030", include: true }),
    ]);
  });

  it("will not save a figure that is not a whole number", async () => {
    const user = userEvent.setup();
    setup();
    const metres = screen.getByLabelText("Metres for M-01");
    await user.clear(metres);
    await user.type(metres, "12.5");
    expect(screen.getByText("Fix the marked rows first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save 1 as submitted/ })).toBeDisabled();
  });
});

describe("other states", () => {
  it("a failed slip says why and offers to set the shift", () => {
    current = slip({ status: "failed", problem: "The date and shift could not be told from the slip.", rows: [], dateKey: null, shift: null, dateFrom: null });
    setup();
    expect(screen.getByText(/could not be told from the slip/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Match to this shift" })).toBeDisabled();
  });

  it("a saved slip shows what was saved and offers nothing to change", () => {
    current = slip({
      status: "applied",
      rows: [{ ...slip().rows![0], applied: true, appliedProduction: 1200 }],
    });
    setup();
    expect(screen.getByText("Saved · 1200 m")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /as submitted/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Drop/ })).not.toBeInTheDocument();
  });

  it("one still being read says so", () => {
    current = slip({ status: "reading", rows: [], photos: [] });
    setup();
    expect(screen.getByText(/Reading the photo/)).toBeInTheDocument();
  });
});
