import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PreviousShiftReading, previousFigure } from "./PreviousShiftReading";
import type { PreviousReading } from "./types";

// Beside an entry awaiting verification: what the same loom's timer read
// the shift before, whether or not that shift has been verified itself.

const getBlob = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: vi.fn(), getBlob: (...a: unknown[]) => getBlob(...a) } };
});

const previous = (over: Partial<PreviousReading> = {}): PreviousReading => ({
  shift: { dateKey: "2026-10-03", shift: "NIGHT", label: "Night shift · 3 Oct 2026" },
  operator: "Sita", runTime: "7:45:00", verified: false, entryId: "sd-8",
  photo: { id: "ph1", takenAt: "2026-10-04T02:10:00Z", byName: "Night Sup", readText: "07:45:12", runTimeUsed: "7:45:00", used: true },
  ...over,
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  getBlob.mockReset();
  getBlob.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});

describe("the reading the shift before", () => {
  it("shows the run time as it stands, the photo it came from, and that it is still unverified; the photo opens full size", async () => {
    wrap(<PreviousShiftReading previous={previous()} />);
    const block = screen.getByLabelText("Timer the shift before");
    expect(block).toHaveTextContent("Shift before · Night shift · 3 Oct 2026");
    expect(block).toHaveTextContent("Timer read 7:45:00 · Sita");
    expect(block).toHaveTextContent("Not verified yet — the figure is as the floor submitted it.");
    expect(block).toHaveTextContent(/Photo by Night Sup at .* · used for the run time/);
    expect(getBlob).toHaveBeenCalledWith("/ocr/timer/photo/ph1/file");
    expect(await within(block).findByAltText("Timer photo from the Night shift · 3 Oct 2026")).toHaveAttribute("src", "blob:photo");

    await userEvent.click(within(block).getByRole("button", { name: /open the timer photo/i }));
    expect(screen.getByAltText("The loom's timer the shift before, full size")).toBeInTheDocument();
    expect(screen.getByText("Timer at the end of the night shift · 3 oct 2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /close the photo/i }));
    expect(screen.queryByAltText("The loom's timer the shift before, full size")).not.toBeInTheDocument();
  });

  it("says when the figure is verified, when no photo was taken, and when the loom was not on that shift", () => {
    const { rerender } = wrap(<PreviousShiftReading previous={previous({ verified: true, photo: null })} />);
    let block = screen.getByLabelText("Timer the shift before");
    expect(block).toHaveTextContent("Verified by the office.");
    expect(block).toHaveTextContent("No timer photo was taken.");
    expect(getBlob).not.toHaveBeenCalled();

    rerender(<QueryClientProvider client={new QueryClient()}><PreviousShiftReading previous={previous({ operator: null, runTime: null, entryId: null, photo: null })} /></QueryClientProvider>);
    block = screen.getByLabelText("Timer the shift before");
    expect(block).toHaveTextContent("This loom was not on that shift.");
    expect(block).not.toHaveTextContent(/verified/i);
  });

  it("is one line on the list card, and nothing at all without a shift before", () => {
    wrap(<PreviousShiftReading previous={previous()} compact />);
    expect(screen.getByLabelText("Timer the shift before")).toHaveTextContent("Shift before (Sita): timer 7:45:00 · not verified yet");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    const { container } = wrap(<PreviousShiftReading previous={null} compact />);
    expect(container).toBeEmptyDOMElement();
  });

  it("falls back to what the photo read when no run time was entered", () => {
    expect(previousFigure(previous({ runTime: null }))).toBe("7:45:00");
    expect(previousFigure(previous({ runTime: null, photo: { ...previous().photo!, runTimeUsed: null, used: false } }))).toBe("07:45:12");
    expect(previousFigure(previous({ runTime: null, photo: null }))).toBeNull();
    expect(previousFigure(previous({ runTime: "8:00:00" }))).toBe("8:00:00");
  });
});
